#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <espnow.h>
  extern "C" {
    #include "user_interface.h"
  }
#else
  #include <WiFi.h>
  #include <esp_now.h>
  #include "esp_wifi.h"
#endif

#include <PubSubClient.h>
#include "DHT.h"
#include <Wire.h>

// ============ MPU6050 REGISTERS ============
#define MPU6050_ADDR 0x68
#define MPU6050_PWR_MGMT_1 0x6B
#define MPU6050_ACCEL_XOUT_H 0x3B

// ============ CONFIGURATION (CHANGE FOR EACH NODE) ============
const char* NODE_ID = "Node-2";  // ← CHANGE THIS: "Node-1", "Node-2", "Node-4"

const char* WIFI_SSID = "wifimob";
const char* WIFI_PASS = "ajay1234";
const char* MQTT_BROKER = "10.147.59.249";

// ESP-NOW peer MAC addresses (optional - system works without them)
#define PEER_COUNT 3
uint8_t PEERS[PEER_COUNT][6] = {
  {0xBC, 0xFF, 0x4D, 0x82, 0xB2, 0x6B}, // Node-1
  {0xBC, 0xFF, 0x4D, 0x82, 0x8E, 0xC9}, // Node-2
  {0xBC, 0xFF, 0x4D, 0x82, 0x8D, 0x5D}  // Node-4
};

// ============ HARDWARE PINS ============
#if defined(ESP8266)
  const int potPin = A0;
  const int relayPin = 12;  
  const int dhtPin = 14;    
  const int statusLed = 2;
#else
  const int potPin = 34;
  const int relayPin = 16;
  const int dhtPin = 4;
  const int statusLed = 2;
#endif

#define DHTTYPE DHT11
DHT dht(dhtPin, DHTTYPE);

// ============ TIMING CONSTANTS ============
const unsigned long HEARTBEAT_INTERVAL = 3000;    // MQTT heartbeat every 3s
const unsigned long ESPNOW_BROADCAST = 1000;      // ESP-NOW fast updates every 1s
const unsigned long LEADER_TIMEOUT = 10000;       // Leader timeout after 10s
const unsigned long NODE_TIMEOUT = 15000;         // Consider node dead after 15s
const unsigned long ELECTION_BACKOFF_MIN = 1000;
const unsigned long ELECTION_BACKOFF_MAX = 2000;
const unsigned long RESTORE_CHECK_INTERVAL = 5000; // Check for restore every 5s
const float WARNING_THRESHOLD = 18.0;             // LED warning when total > 18kW
const float LOAD_THRESHOLD = 21.0;                // Shutdown when total > 21kW
const float RESTORE_THRESHOLD = 15.0;             // Restore nodes when below 15kW
const float CRITICAL_THRESHOLD = 28.0;            // ESP-NOW emergency threshold
const float VIBRATION_THRESHOLD = 2.0;            // Vibration alert threshold (g-force)
const unsigned long VIBRATION_CHECK_INTERVAL = 500; // Check vibration every 500ms
const float TEMP_MODERATE = 35.0;                 // Temperature moderate threshold (°C)
const float TEMP_HIGH = 40.0;                     // Temperature high/alert threshold (°C)

// ============ FORWARD DECLARATIONS ============
void sendESPNowUpdate(uint8_t msgType);

// ============ STATE VARIABLES ============
bool isLeader = false;
String currentLeaderID = "";
unsigned long lastLeaderHeartbeat = 0;
unsigned long lastMyHeartbeat = 0;
unsigned long lastESPNowBroadcast = 0;
unsigned long lastElectionCheck = 0;
unsigned long lastRestoreCheck = 0;
unsigned long lastVibrationCheck = 0;
unsigned long bootTime = 0;
unsigned long lastShutdownTime = 0;  // Track when last shutdown happened
bool inElection = false;
bool isShutdown = false;
bool espnowAvailable = true;
bool wasManualShutdown = false;  // Track if shutdown was manual vs auto
bool mpu6050Available = false;  // Track if MPU6050 is connected
float currentVibration = 0.0;   // Current vibration level in g-force
bool inWarningState = false;    // Track if system is in warning state
unsigned long lastWarningBlink = 0;  // Track LED blink timing for warning

// Performance metrics
unsigned long mqttMessagesRx = 0;
unsigned long mqttMessagesTx = 0;
unsigned long espnowMessagesRx = 0;
unsigned long espnowMessagesTx = 0;
unsigned long espnowLatencySum = 0;
unsigned long espnowLatencyCount = 0;

// Peer tracking
struct NodeData {
  String nodeID;
  float load;
  float temp;
  float vibration;  // Vibration level in g-force
  bool isLeader;
  bool isShutdown;
  float loadBeforeShutdown;  // Remember load before shutdown
  unsigned long shutdownTime;  // When this node was shutdown
  unsigned long lastSeenMQTT;
  unsigned long lastSeenESPNow;  // Track ESP-NOW freshness
  bool espnowReachable;
} nodes[10];
int nodeCount = 0;

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// ============ ESP-NOW MESSAGE STRUCTURE ============
typedef struct {
  char nodeID[16];
  uint8_t msgType;      // 0=fast_update, 1=emergency_alert, 2=peer_shutdown, 3=vibration_alert
  float load;
  float temp;
  float vibration;      // Vibration level in g-force
  bool isLeader;
  bool isShutdown;
  uint32_t sequence;
  unsigned long timestamp;
} ESPNowMessage;

uint32_t espnowSequence = 0;

// ============ HELPER FUNCTIONS ============
String getMyMAC() {
  uint8_t mac[6];
#if defined(ESP8266)
  WiFi.macAddress(mac);
#else
  WiFi.macAddress(mac);
#endif
  char buf[18];
  sprintf(buf, "%02X:%02X:%02X:%02X:%02X:%02X",
          mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

bool macEqual(const uint8_t *a, const uint8_t *b) {
  for (int i = 0; i < 6; i++) if (a[i] != b[i]) return false;
  return true;
}

void getMyMACBytes(uint8_t *macOut) {
#if defined(ESP8266)
  WiFi.macAddress(macOut);
#else
  WiFi.macAddress(macOut);
#endif
}

int findNodeIndex(String nodeID) {
  for (int i = 0; i < nodeCount; i++) {
    if (nodes[i].nodeID == nodeID) return i;
  }
  return -1;
}

void updateNodeData(String nodeID, float load, float temp, bool leader, bool shutdown, bool fromESPNow = false, float vibration = 0.0) {
  int idx = findNodeIndex(nodeID);
  if (idx < 0) {
    if (nodeCount < 10) {
      idx = nodeCount++;
    } else {
      return;
    }
  }
  
  nodes[idx].nodeID = nodeID;
  nodes[idx].vibration = vibration;
  
  // Save load before shutdown transition
  if (!nodes[idx].isShutdown && shutdown) {
    // Node is being shutdown - save its current load and time
    nodes[idx].loadBeforeShutdown = nodes[idx].load;
    nodes[idx].shutdownTime = millis();
  } else if (nodes[idx].isShutdown && !shutdown) {
    // Node is being restored - reset the saved load
    nodes[idx].loadBeforeShutdown = 0.0;
    nodes[idx].shutdownTime = 0;
  } else if (nodes[idx].isShutdown && shutdown) {
    // Node is STILL shutdown - update the expected load if it drops
    // This allows restoration if user reduces the load while shutdown
    if (load < nodes[idx].loadBeforeShutdown) {
      nodes[idx].loadBeforeShutdown = load;
    }
  }
  
  nodes[idx].load = load;
  nodes[idx].temp = temp;
  nodes[idx].isLeader = leader;
  nodes[idx].isShutdown = shutdown;
  
  if (fromESPNow) {
    nodes[idx].lastSeenESPNow = millis();
    nodes[idx].espnowReachable = true;
  } else {
    nodes[idx].lastSeenMQTT = millis();
  }
}

bool amILowestMAC() {
  String myMAC = getMyMAC();
  String myNodeID = String(NODE_ID) + " (" + myMAC + ")";
  unsigned long now = millis();
  
  // Check all active, non-shutdown nodes
  for (int i = 0; i < nodeCount; i++) {
    if ((now - nodes[i].lastSeenMQTT) < LEADER_TIMEOUT && !nodes[i].isShutdown) {
      int macStart = nodes[i].nodeID.indexOf("(");
      if (macStart > 0) {
        String peerMAC = nodes[i].nodeID.substring(macStart + 1, nodes[i].nodeID.indexOf(")"));
        // Only compare if it's a different node
        if (nodes[i].nodeID != myNodeID && peerMAC < myMAC) {
          return false;
        }
      }
    }
  }
  return true;
}

// ============ MPU6050 FUNCTIONS ============
void setupMPU6050() {
  Serial.println("\nSetting up MPU6050...");
  
  Wire.begin();
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_PWR_MGMT_1);
  Wire.write(0);  // Wake up MPU6050
  byte error = Wire.endTransmission();
  
  if (error == 0) {
    mpu6050Available = true;
    Serial.println("   MPU6050 ready");
  } else {
    mpu6050Available = false;
    Serial.println("   MPU6050 not found - vibration monitoring disabled");
  }
}

float readVibration() {
  if (!mpu6050Available) return 0.0;
  
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_ACCEL_XOUT_H);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)MPU6050_ADDR, (size_t)6, true);
  
  if (Wire.available() < 6) return 0.0;
  
  int16_t ax = (Wire.read() << 8) | Wire.read();
  int16_t ay = (Wire.read() << 8) | Wire.read();
  int16_t az = (Wire.read() << 8) | Wire.read();
  
  // Convert to g-force (MPU6050 default ±2g range, 16384 LSB/g)
  float ax_g = ax / 16384.0;
  float ay_g = ay / 16384.0;
  float az_g = (az / 16384.0) - 1.0;  // Subtract 1g for gravity
  
  // Calculate vibration magnitude (RMS)
  float vibration = sqrt(ax_g*ax_g + ay_g*ay_g + az_g*az_g);
  
  return vibration;
}

void checkVibration() {
  if (!mpu6050Available) return;
  
  unsigned long now = millis();
  if (now - lastVibrationCheck < VIBRATION_CHECK_INTERVAL) return;
  
  lastVibrationCheck = now;
  currentVibration = readVibration();
  
  // Alert on high vibration
  if (currentVibration > VIBRATION_THRESHOLD) {
    Serial.printf("HIGH VIBRATION: %.2f g\n", currentVibration);
    
    // Send ESP-NOW vibration alert
    if (espnowAvailable) {
      sendESPNowUpdate(3);  // msgType 3 = vibration_alert
    }
    
    // Publish MQTT event
    if (mqttClient.connected()) {
      String eventMsg = String(NODE_ID) + " high vibration: " + String(currentVibration, 2) + " g";
      mqttClient.publish("grid/events", eventMsg.c_str());
      mqttMessagesTx++;
    }
  }
}

void checkTemperature(float temp) {
  if (temp <= -900) return;  // Invalid reading
  
  static unsigned long lastTempAlert = 0;
  unsigned long now = millis();
  
  // Alert on high temperature (throttle to once per 30 seconds)
  if (temp > TEMP_HIGH && (now - lastTempAlert) > 30000) {
    lastTempAlert = now;
    Serial.printf("HIGH TEMPERATURE: %.1f °C\n", temp);
    
    // Publish MQTT event
    if (mqttClient.connected()) {
      String eventMsg = String(NODE_ID) + " high temperature: " + String(temp, 1) + " °C";
      mqttClient.publish("grid/events", eventMsg.c_str());
      mqttMessagesTx++;
    }
  }
}

// ============ ESP-NOW CALLBACKS ============
#if defined(ESP8266)
void onESPNowDataSent(uint8_t *mac_addr, uint8_t status) {
  if (status == 0) espnowMessagesTx++;
}

void onESPNowDataRecv(uint8_t *mac_addr, uint8_t *data, uint8_t len) {
  if (len != sizeof(ESPNowMessage)) return;
  
  ESPNowMessage msg;
  memcpy(&msg, data, sizeof(msg));
  
  espnowMessagesRx++;
  
  // Track latency for performance monitoring
  unsigned long latency = millis() - msg.timestamp;
  if (latency < 1000) {  // Only count reasonable latencies (< 1 second)
    espnowLatencySum += latency;
    espnowLatencyCount++;
  }
  
  // Update node data from ESP-NOW
  updateNodeData(String(msg.nodeID), msg.load, msg.temp, msg.isLeader, msg.isShutdown, true, msg.vibration);
  
  // Handle emergency alerts
  if (msg.msgType == 1) {  // Emergency alert
    Serial.printf("ESP-NOW Emergency from %s (load=%.2f)\n", msg.nodeID, msg.load);
    digitalWrite(statusLed, HIGH);  // Blink OFF (GPIO2 active-LOW)
    delay(100);
    digitalWrite(statusLed, LOW);   // Back ON
  }
  
  // Handle peer shutdown command
  if (msg.msgType == 2 && String(msg.nodeID) == String(NODE_ID)) {
    Serial.println("ESP-NOW peer shutdown received");
    digitalWrite(relayPin, LOW);
    digitalWrite(statusLed, HIGH);  // LED OFF when shutdown (GPIO2 active-LOW)
    isShutdown = true;
  }
  
  // Handle vibration alerts
  if (msg.msgType == 3) {
    Serial.printf("Vibration alert from %s: %.2f g\n", msg.nodeID, msg.vibration);
  }
}
#else
void onESPNowDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  if (status == ESP_NOW_SEND_SUCCESS) espnowMessagesTx++;
}

void onESPNowDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len != sizeof(ESPNowMessage)) return;
  
  ESPNowMessage msg;
  memcpy(&msg, data, sizeof(msg));
  
  espnowMessagesRx++;
  
  // Track latency for performance monitoring
  unsigned long latency = millis() - msg.timestamp;
  if (latency < 1000) {  // Only count reasonable latencies (< 1 second)
    espnowLatencySum += latency;
    espnowLatencyCount++;
  }
  
  updateNodeData(String(msg.nodeID), msg.load, msg.temp, msg.isLeader, msg.isShutdown, true, msg.vibration);
  
  if (msg.msgType == 1) {
    Serial.printf("ESP-NOW Emergency from %s (load=%.2f)\n", msg.nodeID, msg.load);
    digitalWrite(statusLed, HIGH);  // Blink OFF (GPIO2 active-LOW)
    delay(100);
    digitalWrite(statusLed, LOW);   // Back ON
  }
  
  if (msg.msgType == 2 && String(msg.nodeID) == String(NODE_ID)) {
    Serial.println("ESP-NOW peer shutdown received");
    digitalWrite(relayPin, LOW);
    digitalWrite(statusLed, HIGH);  // LED OFF when shutdown (GPIO2 active-LOW)
    isShutdown = true;
  }
  
  // Handle vibration alerts
  if (msg.msgType == 3) {
    Serial.printf("Vibration alert from %s: %.2f g\n", msg.nodeID, msg.vibration);
  }
}
#endif

// ============ ESP-NOW SETUP ============
void setupESPNow() {
  Serial.println("\nSetting up ESP-NOW...");
  
#if defined(ESP8266)
  if (esp_now_init() != 0) {
    Serial.println("   ESP-NOW init failed - continuing with MQTT only");
    espnowAvailable = false;
    return;
  }
  esp_now_set_self_role(ESP_NOW_ROLE_COMBO);
  esp_now_register_recv_cb(onESPNowDataRecv);
  esp_now_register_send_cb(onESPNowDataSent);
  
  // Add peers
  uint8_t myMAC[6];
  getMyMACBytes(myMAC);
  for (int i = 0; i < PEER_COUNT; i++) {
    if (!macEqual(PEERS[i], myMAC)) {
      if (esp_now_add_peer(PEERS[i], ESP_NOW_ROLE_COMBO, WiFi.channel(), NULL, 0) == 0) {
        Serial.printf("   Added peer: %02X:%02X:...\n", PEERS[i][0], PEERS[i][1]);
      }
    }
  }
#else
  if (esp_now_init() != ESP_OK) {
    Serial.println("   ESP-NOW init failed - continuing with MQTT only");
    espnowAvailable = false;
    return;
  }
  esp_now_register_recv_cb(onESPNowDataRecv);
  esp_now_register_send_cb(onESPNowDataSent);
  
  // Add peers
  uint8_t myMAC[6];
  getMyMACBytes(myMAC);
  esp_now_peer_info_t peerInfo;
  memset(&peerInfo, 0, sizeof(peerInfo));
  peerInfo.channel = WiFi.channel();
  peerInfo.encrypt = false;
  
  for (int i = 0; i < PEER_COUNT; i++) {
    if (!macEqual(PEERS[i], myMAC)) {
      memcpy(peerInfo.peer_addr, PEERS[i], 6);
      if (esp_now_add_peer(&peerInfo) == ESP_OK) {
        Serial.printf("   Added peer: %02X:%02X:...\n", PEERS[i][0], PEERS[i][1]);
      }
    }
  }
#endif
  
  Serial.println("   ESP-NOW ready (optional fast path)");
}

// ============ SEND ESP-NOW BROADCAST ============
void sendESPNowUpdate(uint8_t msgType = 0) {
  if (!espnowAvailable) return;
  
  ESPNowMessage msg = {};
  strncpy(msg.nodeID, NODE_ID, sizeof(msg.nodeID) - 1);
  msg.msgType = msgType;
  
#if defined(ESP8266)
  msg.load = analogRead(A0) / 1023.0 * 10.0;
#else
  msg.load = analogRead(potPin) / 4095.0 * 10.0;
#endif
  
  msg.temp = dht.readTemperature();
  if (isnan(msg.temp)) msg.temp = -999.0;
  msg.vibration = currentVibration;
  msg.isLeader = isLeader;
  msg.isShutdown = isShutdown;
  msg.sequence = espnowSequence++;
  msg.timestamp = millis();
  
  // Broadcast to all peers
  uint8_t myMAC[6];
  getMyMACBytes(myMAC);
  for (int i = 0; i < PEER_COUNT; i++) {
    if (!macEqual(PEERS[i], myMAC)) {
      esp_now_send(PEERS[i], (uint8_t*)&msg, sizeof(msg));
    }
  }
}

// ============ MQTT CALLBACK ============
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char buf[512];
  if (length >= sizeof(buf)) length = sizeof(buf) - 1;
  memcpy(buf, payload, length);
  buf[length] = '\0';
  
  mqttMessagesRx++;
  
  String msg = String(buf);
  String topicStr = String(topic);
  
  // Parse heartbeat messages
  if (topicStr.startsWith("grid/heartbeat/")) {
    String senderID = topicStr.substring(15);
    
    float load = 0, temp = 0, vibration = 0;
    bool leader = false, shutdown = false;
    
    int loadIdx = msg.indexOf("\"load\":");
    if (loadIdx > 0) load = msg.substring(loadIdx + 7).toFloat();
    
    int tempIdx = msg.indexOf("\"temp\":");
    if (tempIdx > 0) temp = msg.substring(tempIdx + 7).toFloat();
    
    int vibIdx = msg.indexOf("\"vibration\":");
    if (vibIdx > 0) vibration = msg.substring(vibIdx + 12).toFloat();
    
    leader = msg.indexOf("\"leader\":true") > 0;
    shutdown = msg.indexOf("\"shutdown\":true") > 0;
    
    updateNodeData(senderID, load, temp, leader, shutdown, false, vibration);
    
    if (leader) {
      if (currentLeaderID != senderID) {
        Serial.printf("New leader detected: %s\n", senderID.c_str());
        currentLeaderID = senderID;
        isLeader = false;
        inElection = false;
      }
      lastLeaderHeartbeat = millis();
      
      // CHALLENGE: If I see a leader but I have lower MAC, challenge them
      String myNodeID = String(NODE_ID) + " (" + getMyMAC() + ")";
      if (!isLeader && !isShutdown && myNodeID != senderID) {
        int macStart = senderID.indexOf("(");
        if (macStart > 0) {
          String leaderMAC = senderID.substring(macStart + 1, senderID.indexOf(")"));
          String myMAC = getMyMAC();
          if (myMAC < leaderMAC) {
            Serial.println("I have lower MAC than current leader! Challenging...");
            lastElectionCheck = 0;  // Trigger immediate election
          }
        }
      }
    }
  }
  
  // Leader summary - check if I should blink (highest load in warning state)
  else if (topicStr == "grid/leader/summary") {
    bool warningState = msg.indexOf("\"warning_state\":true") > 0;
    
    if (warningState && !isShutdown) {
      // Parse nodes array to find if I have highest load
      String myNodeID = String(NODE_ID) + " (" + getMyMAC() + ")";
      float myLoad = 0.0;
      float maxLoad = 0.0;
      
      // Extract my load from heartbeat data
      int idx = findNodeIndex(myNodeID);
      if (idx >= 0) {
        myLoad = nodes[idx].load;
      }
      
      // Find max load among active nodes
      unsigned long now = millis();
      for (int i = 0; i < nodeCount; i++) {
        if ((now - nodes[i].lastSeenMQTT) < LEADER_TIMEOUT && !nodes[i].isShutdown) {
          if (nodes[i].load > maxLoad) {
            maxLoad = nodes[i].load;
          }
        }
      }
      
      // I should blink if I have the highest load (will be shutdown next)
      if (myLoad > 0.1 && abs(myLoad - maxLoad) < 0.5) {  // Within 0.5kW of max
        inWarningState = true;
      } else {
        inWarningState = false;
      }
    } else {
      inWarningState = false;
    }
  }
  
  // Control messages
  else if (topicStr.startsWith("grid/control/")) {
    String targetID = topicStr.substring(13);
    String myNodeID = String(NODE_ID) + " (" + getMyMAC() + ")";
    
    if (targetID == myNodeID || targetID == NODE_ID) {
      if (msg.indexOf("\"shutdown\":true") > 0) {
        // Check if this is manual shutdown (has "manual":true flag)
        bool isManual = msg.indexOf("\"manual\":true") > 0;
        
        if (isManual) {
          Serial.println("MANUAL SHUTDOWN command received");
        } else {
          Serial.println("AUTO SHUTDOWN command received");
        }
        
        digitalWrite(relayPin, LOW);
        digitalWrite(statusLed, HIGH);  // LED OFF when shutdown (GPIO2 active-LOW)
        isShutdown = true;
        wasManualShutdown = isManual;  // Track if this was manual or auto
        
        // If I was leader, step down immediately
        if (isLeader) {
          Serial.println("   → Stepping down as leader");
          isLeader = false;
          currentLeaderID = "";
        }
        
        // Also broadcast via ESP-NOW for immediate peer notification
        if (espnowAvailable) {
          sendESPNowUpdate(1);  // Emergency alert
        }
        
        String ackMsg = String(NODE_ID) + " shutdown confirmed";
        mqttClient.publish("grid/events", ackMsg.c_str());
        mqttMessagesTx++;  // Count event message
      }
      else if (msg.indexOf("\"restore\":true") > 0) {
        Serial.println("RESTORE command received");
        digitalWrite(relayPin, HIGH);
        digitalWrite(statusLed, LOW);  // LED ON when active (GPIO2 active-LOW)
        isShutdown = false;
        wasManualShutdown = false;
        
        // Reset leadership state - do NOT try to become leader immediately
        isLeader = false;
        currentLeaderID = "";
        lastElectionCheck = millis();  // Delay next election check
        
        // Announce we're back
        String eventMsg = String(NODE_ID) + " restored and active";
        mqttClient.publish("grid/events", eventMsg.c_str());
        mqttMessagesTx++;  // Count event message
        
        // Send immediate heartbeat
        sendHeartbeat();
      }
    }
  }
}

// ============ MQTT RECONNECT ============
void mqttReconnect() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    
    String clientID = String(NODE_ID) + "_" + String(random(0xffff), HEX);
    
    if (mqttClient.connect(clientID.c_str())) {
      Serial.println(" OK");
      
      mqttClient.subscribe("grid/heartbeat/#");
      mqttClient.subscribe("grid/leader/summary");
      
      String myNodeID = String(NODE_ID) + " (" + getMyMAC() + ")";
      mqttClient.subscribe(("grid/control/" + myNodeID).c_str());
      mqttClient.subscribe(("grid/control/" + String(NODE_ID)).c_str());
      
      return;
    } else {
      Serial.printf(" FAILED (rc=%d), retry in 3s\n", mqttClient.state());
      delay(3000);
    }
  }
}

// ============ LEADER ELECTION ============
void checkLeaderElection() {
  unsigned long now = millis();
  
  // Don't run election if shutdown or too soon after boot
  if (isShutdown || inElection || (now - bootTime) < 8000) return;
  
  bool leaderAlive = false;
  bool shouldChallengeLeader = false;
  
  if (currentLeaderID != "") {
    int leaderIdx = findNodeIndex(currentLeaderID);
    if (leaderIdx >= 0 && (now - nodes[leaderIdx].lastSeenMQTT) < LEADER_TIMEOUT && !nodes[leaderIdx].isShutdown) {
      leaderAlive = true;
      
      // Check if I should be leader instead (continuous validation)
      if (!isLeader && amILowestMAC()) {
        shouldChallengeLeader = true;
      }
    }
  }
  
  // If I think I'm leader, validate I should still be
  if (isLeader) {
    if ((now - lastMyHeartbeat) > HEARTBEAT_INTERVAL) {
      sendHeartbeat();
    }
    
    // Check if someone with lower MAC appeared
    if (!amILowestMAC()) {
      Serial.println("Someone with lower MAC detected! Stepping down...");
      isLeader = false;
      currentLeaderID = "";
      return;
    }
  }
  
  // Run election if: no leader OR I should challenge current leader
  if ((!leaderAlive || shouldChallengeLeader) && (now - lastElectionCheck) > 3000) {
    lastElectionCheck = now;
    
    if (shouldChallengeLeader) {
      Serial.println("\n🗳️ CHALLENGING CURRENT LEADER");
    } else {
      Serial.println("\n🗳️ LEADER ELECTION (no leader detected)");
    }
    
    Serial.printf("   Current leader: %s\n", currentLeaderID.c_str());
    Serial.printf("   My MAC: %s\n", getMyMAC().c_str());
    
    // Print all active nodes
    Serial.println("   Active nodes:");
    for (int i = 0; i < nodeCount; i++) {
      if ((now - nodes[i].lastSeenMQTT) < LEADER_TIMEOUT && !nodes[i].isShutdown) {
        Serial.printf("     - %s\n", nodes[i].nodeID.c_str());
      }
    }
    
    unsigned long backoff = random(ELECTION_BACKOFF_MIN, ELECTION_BACKOFF_MAX);
    inElection = true;
    delay(backoff);
    
    // Re-check after backoff
    if (amILowestMAC()) {
      // Check if current leader has lower MAC than me
      bool currentLeaderIsValid = false;
      if (currentLeaderID != "") {
        int leaderIdx = findNodeIndex(currentLeaderID);
        if (leaderIdx >= 0 && (millis() - nodes[leaderIdx].lastSeenMQTT) < LEADER_TIMEOUT) {
          int macStart = currentLeaderID.indexOf("(");
          if (macStart > 0) {
            String leaderMAC = currentLeaderID.substring(macStart + 1, currentLeaderID.indexOf(")"));
            if (leaderMAC < getMyMAC()) {
              currentLeaderIsValid = true;
            }
          }
        }
      }
      
      if (!currentLeaderIsValid) {
        Serial.println("   → I have lowest MAC, claiming leadership!");
        promoteToLeader();
      } else {
        Serial.println("   → Current leader has lower MAC, staying follower");
      }
    } else {
      Serial.println("   → Not lowest MAC, staying follower");
    }
    
    inElection = false;
  }
}

void promoteToLeader() {
  // Final validation before claiming leadership
  if (!amILowestMAC()) {
    Serial.println("   Not lowest MAC anymore, aborting leadership claim");
    return;
  }
  
  isLeader = true;
  currentLeaderID = String(NODE_ID) + " (" + getMyMAC() + ")";
  lastLeaderHeartbeat = millis();
  
  Serial.println("\n=== I AM LEADER ===");
  Serial.printf("   %s\n", currentLeaderID.c_str());
  
  // Send multiple heartbeats to announce leadership
  for (int i = 0; i < 3; i++) {
    sendHeartbeat();
    delay(200);
  }
  
  // Announce via ESP-NOW too
  if (espnowAvailable) {
    sendESPNowUpdate(0);
  }
  
  // Publish leadership event
  String eventMsg = currentLeaderID + " elected as leader";
  mqttClient.publish("grid/events", eventMsg.c_str());
  mqttMessagesTx++;  // Count event message
}

// ============ SEND HEARTBEAT ============
void sendHeartbeat() {
  if (!mqttClient.connected()) return;
  
  float load = 0.0;
#if defined(ESP8266)
  load = analogRead(A0) / 1023.0 * 10.0;
#else
  load = analogRead(potPin) / 4095.0 * 10.0;
#endif
  
  float temp = dht.readTemperature();
  if (isnan(temp)) temp = -999.0;
  
  String payload = "{\"load\":";
  payload += String(load, 2);
  payload += ",\"temp\":";
  payload += (temp > -900) ? String(temp, 2) : "null";
  payload += ",\"vibration\":";
  payload += String(currentVibration, 2);
  payload += ",\"leader\":";
  payload += isLeader ? "true" : "false";
  payload += ",\"shutdown\":";
  payload += isShutdown ? "true" : "false";
  payload += ",\"uptime\":";
  payload += String(millis() - bootTime);
  payload += ",\"espnow\":";
  payload += espnowAvailable ? "true" : "false";
  
  // Calculate average ESP-NOW latency
  payload += ",\"espnow_latency\":";
  if (espnowLatencyCount > 0) {
    unsigned long avgLatency = espnowLatencySum / espnowLatencyCount;
    payload += String(avgLatency);
  } else {
    payload += "0";
  }
  
  payload += "}";
  
  String myNodeID = String(NODE_ID) + " (" + getMyMAC() + ")";
  String topic = "grid/heartbeat/" + myNodeID;
  mqttClient.publish(topic.c_str(), payload.c_str());
  mqttMessagesTx++;  // Count MQTT message sent
  
  if (isLeader) {
    Serial.printf("Leader heartbeat (load=%.2f)\n", load);
  }
  
  lastMyHeartbeat = millis();
}

// ============ AGGREGATE & SHED LOAD ============
void aggregateAndShed() {
  if (!isLeader || !mqttClient.connected()) return;
  
  // Throttle: Only run every 2 seconds to avoid spamming MQTT
  static unsigned long lastAggregateTime = 0;
  unsigned long now = millis();
  if ((now - lastAggregateTime) < 2000) return;
  lastAggregateTime = now;
  
  // Validate I should still be leader (continuous check)
  if (!amILowestMAC()) {
    Serial.println("Leadership validation failed! Stepping down...");
    isLeader = false;
    currentLeaderID = "";
    String eventMsg = String(NODE_ID) + " stepping down (lower MAC node detected)";
    mqttClient.publish("grid/events", eventMsg.c_str());
    mqttMessagesTx++;  // Count event message
    return;
  }
  
  float totalLoad = 0.0;
  float totalActiveLoad = 0.0;  // Load from non-shutdown nodes
  String nodesJson = "[";
  bool first = true;
  
  for (int i = 0; i < nodeCount; i++) {
    if ((now - nodes[i].lastSeenMQTT) < LEADER_TIMEOUT) {
      totalLoad += nodes[i].load;
      if (!nodes[i].isShutdown) {
        totalActiveLoad += nodes[i].load;
      }
      
      if (!first) nodesJson += ",";
      first = false;
      
      nodesJson += "{\"id\":\"";
      nodesJson += nodes[i].nodeID;
      nodesJson += "\",\"load\":";
      nodesJson += String(nodes[i].load, 2);
      nodesJson += ",\"temp\":";
      nodesJson += (nodes[i].temp > -900) ? String(nodes[i].temp, 2) : "null";
      nodesJson += ",\"vibration\":";
      nodesJson += String(nodes[i].vibration, 2);
      nodesJson += ",\"shutdown\":";
      nodesJson += nodes[i].isShutdown ? "true" : "false";
      nodesJson += ",\"espnow\":";
      nodesJson += nodes[i].espnowReachable ? "true" : "false";
      nodesJson += "}";
    }
  }
  nodesJson += "]";
  
  String payload = "{\"leader\":\"";
  payload += currentLeaderID;
  payload += "\",\"total_load\":";
  payload += String(totalActiveLoad, 2);  // Report only active load
  payload += ",\"warning_state\":";
  payload += (totalActiveLoad > WARNING_THRESHOLD && totalActiveLoad <= LOAD_THRESHOLD) ? "true" : "false";
  payload += ",\"nodes\":";
  payload += nodesJson;
  payload += ",\"mqtt_rx\":";
  payload += String(mqttMessagesRx);
  payload += ",\"mqtt_tx\":";
  payload += String(mqttMessagesTx);
  payload += ",\"espnow_rx\":";
  payload += String(espnowMessagesRx);
  payload += ",\"espnow_tx\":";
  payload += String(espnowMessagesTx);
  
  // Add average ESP-NOW latency
  payload += ",\"espnow_latency\":";
  if (espnowLatencyCount > 0) {
    unsigned long avgLatency = espnowLatencySum / espnowLatencyCount;
    payload += String(avgLatency);
  } else {
    payload += "0";
  }
  
  payload += ",\"timestamp\":";
  payload += String(now);
  payload += "}";
  
  mqttClient.publish("grid/leader/summary", payload.c_str());
  mqttMessagesTx++;  // Count this summary message
  
  // Calculate average latency for display
  unsigned long avgLatency = (espnowLatencyCount > 0) ? (espnowLatencySum / espnowLatencyCount) : 0;
  Serial.printf("Summary (%.2f kW) [MQTT RX:%lu TX:%lu | ESP-NOW RX:%lu TX:%lu Latency:%lums]\n", 
                totalActiveLoad, mqttMessagesRx, mqttMessagesTx, espnowMessagesRx, espnowMessagesTx, avgLatency);
  
  // ============ WARNING STATE ============
  if (totalActiveLoad > WARNING_THRESHOLD && totalActiveLoad <= LOAD_THRESHOLD) {
    if (!inWarningState) {
      inWarningState = true;
      Serial.printf("WARNING: Load %.2f kW exceeds warning threshold %.2f kW (LED blinking)\n", 
                    totalActiveLoad, WARNING_THRESHOLD);
      String eventMsg = "Warning: High load " + String(totalActiveLoad, 2) + " kW";
      mqttClient.publish("grid/events", eventMsg.c_str());
      mqttMessagesTx++;
    }
  } else if (totalActiveLoad <= WARNING_THRESHOLD) {
    if (inWarningState) {
      inWarningState = false;
      digitalWrite(statusLed, LOW);  // LED solid ON when normal
      Serial.println("Load returned to normal (LED solid)");
    }
  }
  
  // ============ LOAD SHEDDING ============
  if (totalActiveLoad > LOAD_THRESHOLD) {
    inWarningState = false;  // Exit warning state when entering shutdown
    Serial.printf("OVERLOAD: %.2f > %.2f\n", totalActiveLoad, LOAD_THRESHOLD);
    
    int targetIdx = -1;
    float maxLoad = -1.0;
    String myNodeID = String(NODE_ID) + " (" + getMyMAC() + ")";
    
    // Find highest load node that is NOT the leader
    for (int i = 0; i < nodeCount; i++) {
      if ((now - nodes[i].lastSeenMQTT) < LEADER_TIMEOUT) {
        if (!nodes[i].isShutdown && nodes[i].load > maxLoad && nodes[i].nodeID != myNodeID) {
          maxLoad = nodes[i].load;
          targetIdx = i;
        }
      }
    }
    
    // If no other node found, only then consider shutting down self (leader)
    if (targetIdx < 0) {
      for (int i = 0; i < nodeCount; i++) {
        if ((now - nodes[i].lastSeenMQTT) < LEADER_TIMEOUT) {
          if (!nodes[i].isShutdown && nodes[i].load > maxLoad && nodes[i].nodeID == myNodeID) {
            maxLoad = nodes[i].load;
            targetIdx = i;
            Serial.println("   No other nodes available, will shutdown self");
          }
        }
      }
    }
    
    if (targetIdx >= 0) {
      String targetNode = nodes[targetIdx].nodeID;
      Serial.printf("   → Shedding %s (%.2f kW)\n", targetNode.c_str(), maxLoad);
      
      // Save load before shutdown
      nodes[targetIdx].loadBeforeShutdown = nodes[targetIdx].load;
      
      // Send via MQTT (reliable)
      String ctrlTopic = "grid/control/" + targetNode;
      String ctrlMsg = "{\"shutdown\":true}";
      mqttClient.publish(ctrlTopic.c_str(), ctrlMsg.c_str());
      mqttMessagesTx++;  // Count control message
      
      // Also try ESP-NOW for instant response
      if (espnowAvailable && nodes[targetIdx].espnowReachable) {
        ESPNowMessage shutdownMsg = {};
        strncpy(shutdownMsg.nodeID, NODE_ID, sizeof(shutdownMsg.nodeID) - 1);
        shutdownMsg.msgType = 2;  // Peer shutdown
        shutdownMsg.timestamp = millis();
        
        // Send to all (target will recognize its ID)
        uint8_t myMAC[6];
        getMyMACBytes(myMAC);
        for (int i = 0; i < PEER_COUNT; i++) {
          if (!macEqual(PEERS[i], myMAC)) {
            esp_now_send(PEERS[i], (uint8_t*)&shutdownMsg, sizeof(shutdownMsg));
          }
        }
        Serial.println("   ESP-NOW emergency shutdown sent");
      }
      
      String eventMsg = "Auto shutdown " + targetNode + " (load: " + String(maxLoad, 2) + " kW)";
      mqttClient.publish("grid/events", eventMsg.c_str());
      mqttMessagesTx++;  // Count event message
      nodes[targetIdx].isShutdown = true;
      nodes[targetIdx].shutdownTime = now;  // Record per-node shutdown time
      
      // If shutting down self, mark it immediately
      if (targetNode == myNodeID) {
        Serial.println("   I am being shutdown, stopping leadership");
        isShutdown = true;
        isLeader = false;
        digitalWrite(relayPin, LOW);
        digitalWrite(statusLed, HIGH);  // LED OFF when shutdown (GPIO2 active-LOW)
      }
    }
  }
  
  // ============ AUTO-RESTORE SHUTDOWN NODES ============
  else if (totalActiveLoad < RESTORE_THRESHOLD && (now - lastRestoreCheck) > RESTORE_CHECK_INTERVAL) {
    // Try restore when below RESTORE_THRESHOLD
    lastRestoreCheck = now;
    
    // Find shutdown nodes that can be restored (with per-node cooldown)
    int bestCandidateIdx = -1;
    float lowestExpectedLoad = 999.0;
    
    for (int i = 0; i < nodeCount; i++) {
      if ((now - nodes[i].lastSeenMQTT) < NODE_TIMEOUT && nodes[i].isShutdown) {
        // Per-node cooldown check
        unsigned long timeSinceShutdown = now - nodes[i].shutdownTime;
        if (timeSinceShutdown < 10000) {  // 10 second cooldown per node
          continue;  // Skip without logging spam
        }
        
        // Use the load BEFORE shutdown for projection
        float nodeLoadEstimate = nodes[i].loadBeforeShutdown > 0.5 ? nodes[i].loadBeforeShutdown : nodes[i].load;
        
        // Find candidate with lowest expected load (safer to restore)
        if (nodeLoadEstimate < lowestExpectedLoad) {
          float projectedLoad = totalActiveLoad + nodeLoadEstimate;
          
          // CRITICAL: projected load must stay below WARNING_THRESHOLD (safe margin)
          if (projectedLoad < WARNING_THRESHOLD) {
            lowestExpectedLoad = nodeLoadEstimate;
            bestCandidateIdx = i;
          }
        }
      }
    }
    
    // Restore the best candidate if found
    if (bestCandidateIdx >= 0) {
      String targetNode = nodes[bestCandidateIdx].nodeID;
      String myNodeID = String(NODE_ID) + " (" + getMyMAC() + ")";
      
      // Don't auto-restore if this node was manually shutdown
      if (targetNode == myNodeID && wasManualShutdown) {
        Serial.printf("   %s was manually shutdown, skipping auto-restore\n", targetNode.c_str());
        return;
      }
      
      float nodeLoadEstimate = nodes[bestCandidateIdx].loadBeforeShutdown > 0.5 ? 
                                nodes[bestCandidateIdx].loadBeforeShutdown : 
                                nodes[bestCandidateIdx].load;
      float projectedLoad = totalActiveLoad + nodeLoadEstimate;
      
      Serial.printf("AUTO-RESTORING %s (current: %.2f + node: %.2f = %.2f kW, safe < %.2f kW)\n", 
            targetNode.c_str(), totalActiveLoad, nodeLoadEstimate, projectedLoad, WARNING_THRESHOLD);
      
      String ctrlTopic = "grid/control/" + targetNode;
      String ctrlMsg = "{\"restore\":true,\"auto\":true}";
      mqttClient.publish(ctrlTopic.c_str(), ctrlMsg.c_str());
      mqttMessagesTx++;  // Count control message
      
      String eventMsg = "Auto restore " + targetNode + " (projected " + String(projectedLoad, 2) + " kW)";
      mqttClient.publish("grid/events", eventMsg.c_str());
      mqttMessagesTx++;  // Count event message
      
      nodes[bestCandidateIdx].isShutdown = false;
      nodes[bestCandidateIdx].loadBeforeShutdown = 0.0;
      nodes[bestCandidateIdx].shutdownTime = 0;
    } else if (nodeCount > 0) {
      Serial.printf("   No nodes ready for restore (active: %.2f kW)\n", totalActiveLoad);
    }
  }
  
  // Critical overload - emergency broadcast
  if (totalActiveLoad > CRITICAL_THRESHOLD && espnowAvailable) {
    sendESPNowUpdate(1);  // Emergency alert
  }
}

// ============ SETUP ============
void setup() {
  pinMode(relayPin, OUTPUT);
  pinMode(statusLed, OUTPUT);
  digitalWrite(relayPin, HIGH);  // Relay ON (active)
  digitalWrite(statusLed, LOW);  // LED ON (active) - GPIO2 is active-LOW on ESP8266
  
  Serial.begin(115200);
  delay(500);
  
  Serial.println("\n\n========================================");
  Serial.println("   EdgeGrid Hybrid: MQTT + ESP-NOW");
  Serial.println("   Reliable MQTT + Fast ESP-NOW");
  Serial.println("========================================");
  Serial.printf("Node: %s\n", NODE_ID);
  Serial.printf("MAC: %s\n", getMyMAC().c_str());
  
  dht.begin();
  setupMPU6050();  // Initialize vibration sensor
  bootTime = millis();
  
  // Connect WiFi first (required for both MQTT and ESP-NOW)
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - wifiStart) < 20000) {
    delay(500);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" OK");
    Serial.printf("IP: %s | Channel: %d\n", WiFi.localIP().toString().c_str(), WiFi.channel());
  } else {
    Serial.println(" FAILED");
    while(1) {
      digitalWrite(statusLed, !digitalRead(statusLed));
      delay(200);
    }
  }
  
  // Setup MQTT (critical)
  mqttClient.setServer(MQTT_BROKER, 1883);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(1024);
  mqttReconnect();
  
  // Setup ESP-NOW (optional enhancement)
  setupESPNow();
  
  Serial.println("\nSystem ready\n");
  Serial.println("Architecture:");
  Serial.println("  MQTT: Control plane (election, commands)");
  Serial.println("  ESP-NOW: Data plane (fast updates, alerts)");
  Serial.println();
}

// ============ MAIN LOOP ============
void loop() {
  unsigned long now = millis();
  
  // MQTT housekeeping (critical path)
  if (!mqttClient.connected()) mqttReconnect();
  mqttClient.loop();
  
  // MQTT heartbeat (3s interval) - ALWAYS send, even when shutdown
  // This lets the leader know we're still alive and can be restored
  if (now - lastMyHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
  }
  
  // ESP-NOW fast broadcast (1s interval - optional)
  if (espnowAvailable && (now - lastESPNowBroadcast > ESPNOW_BROADCAST)) {
    sendESPNowUpdate(0);
    lastESPNowBroadcast = now;
  }
  
  // Check vibration (500ms interval)
  checkVibration();
  
  // Check temperature for alerts
  float currentTemp = dht.readTemperature();
  if (!isnan(currentTemp)) {
    checkTemperature(currentTemp);
  }
  
  // Handle LED warning state (blink when load is high but not critical)
  if (!isShutdown) {
    if (inWarningState && (now - lastWarningBlink > 500)) {
      // Blink LED in warning state (500ms interval)
      digitalWrite(statusLed, !digitalRead(statusLed));
      lastWarningBlink = now;
    } else if (!inWarningState && digitalRead(statusLed) == HIGH) {
      // Ensure LED is ON when not in warning and not shutdown
      digitalWrite(statusLed, LOW);  // LED ON (active-LOW)
    }
  }
  
  // Leader tasks or election
  if (isLeader && !isShutdown) {
    aggregateAndShed();
  } else if (!isShutdown) {
    checkLeaderElection();
  }
  
  delay(50);
}