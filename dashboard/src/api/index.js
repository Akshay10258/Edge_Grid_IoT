import axios from "axios";

// Create axios instance with base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001",
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Send manual control command to a node
 * @param {string} node - Node ID (e.g., "Node-1")
 * @param {string} action - Action to perform ("SHUTDOWN" or "RESTORE")
 * @returns {Promise} - API response
 */
export const sendControlCommand = async (node, action) => {
  try {
    const response = await api.post("/control", {
      node,
      action,
      manual: true, // Mark as manual control to prevent auto-restore
    });
    return response.data;
  } catch (error) {
    console.error("Failed to send control command:", error);
    throw error;
  }
};

export default api;
