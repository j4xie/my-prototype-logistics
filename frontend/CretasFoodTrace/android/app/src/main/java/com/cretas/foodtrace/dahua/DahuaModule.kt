package com.cretas.foodtrace.dahua

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.*
import java.nio.charset.StandardCharsets

/**
 * Dahua DHDiscover Native Module
 *
 * Implements the Dahua DHDiscover protocol for device discovery.
 * Protocol: UDP broadcast on port 37810, JSON-based messages.
 */
class DahuaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "DahuaModule"
        private const val DISCOVERY_PORT = 37810
        private const val MULTICAST_ADDRESS = "239.255.255.251"
        private const val DISCOVERY_TIMEOUT = 5000L // 5 seconds
        private const val RECEIVE_BUFFER_SIZE = 4096
    }

    private var discoverySocket: DatagramSocket? = null
    private var isDiscovering = false
    private var discoveryJob: Job? = null
    private val discoveredDevices = mutableMapOf<String, WritableMap>()
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getName(): String = "DahuaModule"

    /**
     * Start device discovery
     */
    @ReactMethod
    fun startDiscovery(promise: Promise) {
        if (isDiscovering) {
            promise.resolve(true)
            return
        }

        try {
            discoveredDevices.clear()
            isDiscovering = true

            discoveryJob = coroutineScope.launch {
                try {
                    // Create UDP socket
                    discoverySocket = DatagramSocket().apply {
                        broadcast = true
                        soTimeout = 3000
                        reuseAddress = true
                    }

                    sendStatusEvent("started", "Discovery started")

                    // Send discovery probe
                    sendDiscoveryProbe()

                    // Listen for responses
                    listenForResponses()

                } catch (e: Exception) {
                    Log.e(TAG, "Discovery error: ${e.message}", e)
                    sendStatusEvent("error", e.message ?: "Unknown error")
                } finally {
                    cleanup()
                }
            }

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start discovery: ${e.message}", e)
            isDiscovering = false
            promise.reject("DISCOVERY_ERROR", e.message, e)
        }
    }

    /**
     * Stop device discovery
     */
    @ReactMethod
    fun stopDiscovery(promise: Promise) {
        try {
            cleanup()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    /**
     * Check if discovery is active
     */
    @ReactMethod
    fun isDiscovering(promise: Promise) {
        promise.resolve(isDiscovering)
    }

    /**
     * Modify device IP address
     */
    @ReactMethod
    fun modifyDeviceIp(
        mac: String,
        newIp: String,
        netmask: String,
        gateway: String,
        password: String,
        promise: Promise
    ) {
        coroutineScope.launch {
            try {
                val result = sendConfigCommand(mac, mapOf(
                    "method" to "configManager.setConfig",
                    "params" to mapOf(
                        "name" to "Network",
                        "table" to mapOf(
                            "IPAddress" to newIp,
                            "SubnetMask" to netmask,
                            "DefaultGateway" to gateway
                        )
                    ),
                    "password" to password
                ))

                val response = Arguments.createMap().apply {
                    putBoolean("success", result)
                    putString("message", if (result) "IP modified successfully" else "Failed to modify IP")
                }
                promise.resolve(response)
            } catch (e: Exception) {
                val response = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putString("message", e.message ?: "Unknown error")
                }
                promise.resolve(response)
            }
        }
    }

    /**
     * Initialize an uninitialized device (set initial password)
     */
    @ReactMethod
    fun initializeDevice(mac: String, password: String, promise: Promise) {
        coroutineScope.launch {
            try {
                // DHDiscover initialization command
                val initJson = JSONObject().apply {
                    put("method", "DHDiscover.init")
                    put("params", JSONObject().apply {
                        put("mac", mac.uppercase().replace(":", "-"))
                        put("password", password)
                        put("username", "admin")
                    })
                }

                val result = sendBroadcastCommand(initJson.toString())

                // Get device info for response
                val device = discoveredDevices[mac.lowercase().replace(":", "").replace("-", "")]

                val response = Arguments.createMap().apply {
                    putBoolean("success", result)
                    putString("message", if (result) "Device initialized successfully" else "Failed to initialize device")
                    device?.getString("serialNumber")?.let { putString("serialNumber", it) }
                    device?.getString("ip")?.let { putString("ipAddress", it) }
                }
                promise.resolve(response)
            } catch (e: Exception) {
                val response = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putString("message", e.message ?: "Unknown error")
                }
                promise.resolve(response)
            }
        }
    }

    /**
     * Reset device password
     */
    @ReactMethod
    fun resetDevicePassword(
        mac: String,
        serialNumber: String,
        newPassword: String,
        securityCode: String?,
        promise: Promise
    ) {
        coroutineScope.launch {
            try {
                val resetJson = JSONObject().apply {
                    put("method", "DHDiscover.resetPassword")
                    put("params", JSONObject().apply {
                        put("mac", mac.uppercase().replace(":", "-"))
                        put("serialNumber", serialNumber)
                        put("newPassword", newPassword)
                        securityCode?.let { put("securityCode", it) }
                    })
                }

                val result = sendBroadcastCommand(resetJson.toString())

                val response = Arguments.createMap().apply {
                    putBoolean("success", result)
                    putString("message", if (result) "Password reset successfully" else "Failed to reset password")
                    if (!result && securityCode.isNullOrEmpty()) {
                        putBoolean("needSecurityCode", true)
                    }
                }
                promise.resolve(response)
            } catch (e: Exception) {
                val response = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putString("message", e.message ?: "Unknown error")
                }
                promise.resolve(response)
            }
        }
    }

    /**
     * Send DHDiscover.search probe packet
     */
    private fun sendDiscoveryProbe() {
        try {
            // DHDiscover.search JSON format
            val searchJson = JSONObject().apply {
                put("method", "DHDiscover.search")
                put("params", JSONObject().apply {
                    put("mac", "")  // Empty for broadcast search
                })
            }

            val data = searchJson.toString().toByteArray(StandardCharsets.UTF_8)

            // Send to broadcast address
            val broadcastAddress = InetAddress.getByName("255.255.255.255")
            val packet = DatagramPacket(data, data.size, broadcastAddress, DISCOVERY_PORT)
            discoverySocket?.send(packet)
            Log.d(TAG, "Sent DHDiscover.search broadcast")

            // Also try multicast
            try {
                val multicastAddress = InetAddress.getByName(MULTICAST_ADDRESS)
                val multicastPacket = DatagramPacket(data, data.size, multicastAddress, DISCOVERY_PORT)
                discoverySocket?.send(multicastPacket)
                Log.d(TAG, "Sent DHDiscover.search multicast to $MULTICAST_ADDRESS")
            } catch (e: Exception) {
                Log.w(TAG, "Multicast send failed: ${e.message}")
            }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to send discovery probe: ${e.message}", e)
        }
    }

    /**
     * Listen for device responses
     */
    private suspend fun listenForResponses() {
        val buffer = ByteArray(RECEIVE_BUFFER_SIZE)
        val startTime = System.currentTimeMillis()

        while (isDiscovering && System.currentTimeMillis() - startTime < DISCOVERY_TIMEOUT) {
            try {
                val packet = DatagramPacket(buffer, buffer.size)
                discoverySocket?.receive(packet)

                val response = String(packet.data, 0, packet.length, StandardCharsets.UTF_8)
                Log.d(TAG, "Received response from ${packet.address.hostAddress}: $response")

                parseDeviceResponse(response, packet.address.hostAddress ?: "")

            } catch (e: SocketTimeoutException) {
                // Timeout is expected, continue listening
                // Send another probe to keep discovery active
                sendDiscoveryProbe()
            } catch (e: Exception) {
                if (isDiscovering) {
                    Log.e(TAG, "Error receiving response: ${e.message}")
                }
            }
        }

        sendStatusEvent("stopped", "Discovery completed")
    }

    /**
     * Parse device response JSON
     */
    private fun parseDeviceResponse(response: String, sourceIp: String) {
        try {
            val json = JSONObject(response)

            // Check if it's a DHDiscover response
            val method = json.optString("method", "")
            if (!method.contains("DHDiscover", ignoreCase = true) && !json.has("mac")) {
                return
            }

            val params = json.optJSONObject("params") ?: json

            val mac = params.optString("mac", "")
                .lowercase()
                .replace("-", "")
                .replace(":", "")

            if (mac.isEmpty()) return

            val device = Arguments.createMap().apply {
                putString("ip", params.optString("IPv4Address", sourceIp))
                putString("mac", formatMac(mac))
                putString("netmask", params.optString("SubnetMask", "255.255.255.0"))
                putString("gateway", params.optString("DefaultGateway", ""))
                putString("deviceType", params.optString("DeviceType", "IPC"))
                putString("model", params.optString("DeviceModel", params.optString("DeviceName", "")))
                putString("serialNumber", params.optString("SerialNo", params.optString("SN", "")))
                putString("firmwareVersion", params.optString("Version", ""))
                putString("httpPort", params.optString("HttpPort", "80"))
                putString("rtspPort", params.optString("RtspPort", "554"))
                putString("controlPort", params.optString("Port", "37777"))
                putBoolean("initialized", params.optBoolean("Activated", params.optBoolean("Initialized", true)))
                putString("vendor", "Dahua")
                putDouble("discoveredAt", System.currentTimeMillis().toDouble())
                putString("rawJson", response)
            }

            discoveredDevices[mac] = device
            sendDeviceFoundEvent(device)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse device response: ${e.message}")
        }
    }

    /**
     * Format MAC address with colons
     */
    private fun formatMac(mac: String): String {
        return mac.chunked(2).joinToString(":")
    }

    /**
     * Send broadcast command
     */
    private suspend fun sendBroadcastCommand(jsonCommand: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val socket = DatagramSocket().apply {
                    broadcast = true
                    soTimeout = 3000
                }

                val data = jsonCommand.toByteArray(StandardCharsets.UTF_8)
                val broadcastAddress = InetAddress.getByName("255.255.255.255")
                val packet = DatagramPacket(data, data.size, broadcastAddress, DISCOVERY_PORT)
                socket.send(packet)

                // Wait for response
                val responseBuffer = ByteArray(RECEIVE_BUFFER_SIZE)
                val responsePacket = DatagramPacket(responseBuffer, responseBuffer.size)

                try {
                    socket.receive(responsePacket)
                    val response = String(responsePacket.data, 0, responsePacket.length, StandardCharsets.UTF_8)
                    val json = JSONObject(response)
                    val result = json.optBoolean("result", false) || json.optInt("error", -1) == 0
                    socket.close()
                    result
                } catch (e: SocketTimeoutException) {
                    socket.close()
                    false
                }
            } catch (e: Exception) {
                Log.e(TAG, "Broadcast command failed: ${e.message}", e)
                false
            }
        }
    }

    /**
     * Send configuration command (for IP modification)
     */
    private suspend fun sendConfigCommand(mac: String, config: Map<String, Any>): Boolean {
        // For IP modification, we need to use TCP connection to port 37777
        // This is a simplified version - full implementation would require DVRIP protocol
        return sendBroadcastCommand(JSONObject(config).toString())
    }

    /**
     * Send device found event to React Native
     */
    private fun sendDeviceFoundEvent(device: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onDahuaDeviceFound", device)
    }

    /**
     * Send discovery status event to React Native
     */
    private fun sendStatusEvent(status: String, message: String) {
        val event = Arguments.createMap().apply {
            putString("status", status)
            putString("message", message)
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onDahuaDiscoveryStatus", event)
    }

    /**
     * Cleanup resources
     */
    private fun cleanup() {
        isDiscovering = false
        discoveryJob?.cancel()
        discoveryJob = null
        discoverySocket?.close()
        discoverySocket = null
    }

    /**
     * Called when the host activity is destroyed
     */
    override fun invalidate() {
        cleanup()
        coroutineScope.cancel()
        super.invalidate()
    }
}
