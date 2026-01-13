package com.cretas.foodtrace.sadp

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import org.w3c.dom.Element
import org.xml.sax.InputSource
import java.io.StringReader
import java.net.*
import java.nio.charset.StandardCharsets
import javax.xml.parsers.DocumentBuilderFactory

/**
 * SADP (Search Active Device Protocol) Native Module
 *
 * Implements Hikvision's device discovery protocol over UDP multicast.
 * - UDP Port: 37020
 * - Multicast Address: 239.255.255.250
 */
class SadpModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "SadpModule"
        private const val MODULE_NAME = "SadpModule"

        // SADP Protocol Constants
        private const val SADP_PORT = 37020
        private const val MULTICAST_ADDRESS = "239.255.255.250"
        private const val RECEIVE_TIMEOUT = 3000 // ms
        private const val BUFFER_SIZE = 4096

        // SADP Probe XML Template
        private val SADP_PROBE_XML = """
            <?xml version="1.0" encoding="utf-8"?>
            <Probe>
                <Uuid>%s</Uuid>
                <Types>inquiry</Types>
            </Probe>
        """.trimIndent()

        // SADP Modify IP XML Template
        private val SADP_MODIFY_IP_XML = """
            <?xml version="1.0" encoding="utf-8"?>
            <ProbeMatch>
                <Uuid>%s</Uuid>
                <MAC>%s</MAC>
                <Types>update</Types>
                <IPv4Address>%s</IPv4Address>
                <IPv4SubnetMask>%s</IPv4SubnetMask>
                <IPv4Gateway>%s</IPv4Gateway>
                <Password>%s</Password>
            </ProbeMatch>
        """.trimIndent()

        // SADP Activate XML Template
        private val SADP_ACTIVATE_XML = """
            <?xml version="1.0" encoding="utf-8"?>
            <ProbeMatch>
                <Uuid>%s</Uuid>
                <MAC>%s</MAC>
                <Types>activate</Types>
                <Password>%s</Password>
            </ProbeMatch>
        """.trimIndent()
    }

    private var socket: MulticastSocket? = null
    private var isDiscovering = false
    private var discoveryJob: Job? = null
    private val discoveredDevices = mutableMapOf<String, WritableMap>()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getName(): String = MODULE_NAME

    override fun getConstants(): Map<String, Any> {
        return mapOf(
            "SADP_PORT" to SADP_PORT,
            "MULTICAST_ADDRESS" to MULTICAST_ADDRESS
        )
    }

    /**
     * Start device discovery
     */
    @ReactMethod
    fun startDiscovery(promise: Promise) {
        if (isDiscovering) {
            promise.resolve(true)
            return
        }

        discoveryJob = scope.launch {
            try {
                isDiscovering = true
                discoveredDevices.clear()

                sendStatusEvent("started", "Discovery started")
                Log.d(TAG, "Starting SADP discovery on port $SADP_PORT")

                // Create multicast socket
                socket = MulticastSocket(SADP_PORT).apply {
                    reuseAddress = true
                    soTimeout = RECEIVE_TIMEOUT
                    joinGroup(InetAddress.getByName(MULTICAST_ADDRESS))
                }

                // Send probe
                sendProbe()

                // Listen for responses
                val buffer = ByteArray(BUFFER_SIZE)
                while (isDiscovering) {
                    try {
                        val packet = DatagramPacket(buffer, buffer.size)
                        socket?.receive(packet)

                        val response = String(packet.data, 0, packet.length, StandardCharsets.UTF_8)
                        Log.d(TAG, "Received SADP response from ${packet.address.hostAddress}")

                        parseAndEmitDevice(response, packet.address.hostAddress ?: "")
                    } catch (e: SocketTimeoutException) {
                        // Timeout is expected, send another probe
                        if (isDiscovering) {
                            sendProbe()
                        }
                    }
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Discovery error", e)
                sendStatusEvent("error", e.message ?: "Unknown error")
                withContext(Dispatchers.Main) {
                    promise.reject("DISCOVERY_ERROR", e.message, e)
                }
            }
        }
    }

    /**
     * Stop device discovery
     */
    @ReactMethod
    fun stopDiscovery(promise: Promise) {
        try {
            isDiscovering = false
            discoveryJob?.cancel()
            socket?.apply {
                try {
                    leaveGroup(InetAddress.getByName(MULTICAST_ADDRESS))
                } catch (e: Exception) {
                    Log.w(TAG, "Error leaving multicast group", e)
                }
                close()
            }
            socket = null

            sendStatusEvent("stopped", "Discovery stopped")
            Log.d(TAG, "SADP discovery stopped")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping discovery", e)
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
        scope.launch {
            try {
                val uuid = java.util.UUID.randomUUID().toString()
                val xml = String.format(
                    SADP_MODIFY_IP_XML,
                    uuid,
                    mac.uppercase().replace(":", "-"),
                    newIp,
                    netmask,
                    gateway,
                    password
                )

                val response = sendSadpCommand(xml)

                val result = Arguments.createMap().apply {
                    putBoolean("success", response != null)
                    putString("message", if (response != null) "IP modified successfully" else "No response from device")
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error modifying IP", e)
                val result = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putString("message", e.message ?: "Unknown error")
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            }
        }
    }

    /**
     * Activate an unactivated device
     */
    @ReactMethod
    fun activateDevice(mac: String, password: String, promise: Promise) {
        scope.launch {
            try {
                val uuid = java.util.UUID.randomUUID().toString()
                val xml = String.format(
                    SADP_ACTIVATE_XML,
                    uuid,
                    mac.uppercase().replace(":", "-"),
                    password
                )

                val response = sendSadpCommand(xml)

                val result = Arguments.createMap().apply {
                    putBoolean("success", response != null)
                    putString("message", if (response != null) "Device activated successfully" else "No response from device")
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error activating device", e)
                val result = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putString("message", e.message ?: "Unknown error")
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            }
        }
    }

    /**
     * Reset device password (placeholder - requires security code)
     */
    @ReactMethod
    fun resetDevicePassword(
        mac: String,
        serialNumber: String,
        newPassword: String,
        securityCode: String?,
        promise: Promise
    ) {
        val result = Arguments.createMap().apply {
            putBoolean("success", false)
            putString("message", "Password reset requires Hikvision security code. Please contact Hikvision support.")
            putBoolean("needSecurityCode", true)
        }
        promise.resolve(result)
    }

    /**
     * Restore factory settings (placeholder)
     */
    @ReactMethod
    fun restoreFactorySettings(mac: String, password: String, promise: Promise) {
        val result = Arguments.createMap().apply {
            putBoolean("success", false)
            putString("message", "Factory restore is not supported via SADP. Please use device web interface.")
        }
        promise.resolve(result)
    }

    // ==================== Private Methods ====================

    private fun sendProbe() {
        try {
            val uuid = java.util.UUID.randomUUID().toString()
            val probeXml = String.format(SADP_PROBE_XML, uuid)
            val data = probeXml.toByteArray(StandardCharsets.UTF_8)

            val packet = DatagramPacket(
                data,
                data.size,
                InetAddress.getByName(MULTICAST_ADDRESS),
                SADP_PORT
            )

            socket?.send(packet)
            Log.d(TAG, "Sent SADP probe")
        } catch (e: Exception) {
            Log.e(TAG, "Error sending probe", e)
        }
    }

    private fun sendSadpCommand(xml: String): String? {
        var responseSocket: MulticastSocket? = null
        try {
            responseSocket = MulticastSocket(SADP_PORT).apply {
                reuseAddress = true
                soTimeout = 5000
                joinGroup(InetAddress.getByName(MULTICAST_ADDRESS))
            }

            val data = xml.toByteArray(StandardCharsets.UTF_8)
            val packet = DatagramPacket(
                data,
                data.size,
                InetAddress.getByName(MULTICAST_ADDRESS),
                SADP_PORT
            )

            responseSocket.send(packet)

            // Wait for response
            val buffer = ByteArray(BUFFER_SIZE)
            val responsePacket = DatagramPacket(buffer, buffer.size)
            responseSocket.receive(responsePacket)

            return String(responsePacket.data, 0, responsePacket.length, StandardCharsets.UTF_8)
        } catch (e: SocketTimeoutException) {
            Log.w(TAG, "Command timeout - no response")
            return null
        } finally {
            responseSocket?.apply {
                try {
                    leaveGroup(InetAddress.getByName(MULTICAST_ADDRESS))
                } catch (e: Exception) { }
                close()
            }
        }
    }

    private fun parseAndEmitDevice(xml: String, sourceIp: String) {
        try {
            val factory = DocumentBuilderFactory.newInstance()
            val builder = factory.newDocumentBuilder()
            val doc = builder.parse(InputSource(StringReader(xml)))

            val root = doc.documentElement
            if (root.tagName != "ProbeMatch") {
                return
            }

            val mac = getElementText(root, "MAC")?.replace("-", ":") ?: return
            val ip = getElementText(root, "IPv4Address") ?: sourceIp

            val device = Arguments.createMap().apply {
                putString("mac", mac)
                putString("ip", ip)
                putString("netmask", getElementText(root, "IPv4SubnetMask") ?: "255.255.255.0")
                putString("gateway", getElementText(root, "IPv4Gateway") ?: "")
                putString("deviceType", getElementText(root, "DeviceType") ?: "IPC")
                putString("model", getElementText(root, "Model") ?: getElementText(root, "DeviceDescription") ?: "")
                putString("serialNumber", getElementText(root, "DeviceSN") ?: getElementText(root, "SerialNumber") ?: "")
                putString("firmwareVersion", getElementText(root, "SoftwareVersion") ?: "")
                putString("httpPort", getElementText(root, "HttpPort") ?: "80")
                putBoolean("activated", getElementText(root, "Activated")?.lowercase() == "true")
                putBoolean("dhcp", getElementText(root, "DHCP")?.lowercase() == "true")
                putDouble("discoveredAt", System.currentTimeMillis().toDouble())
                putString("rawXml", xml)
            }

            // Check if this is a new or updated device
            val existingDevice = discoveredDevices[mac]
            discoveredDevices[mac] = device

            // Emit event
            sendEvent("onDeviceFound", device)

            Log.d(TAG, "Discovered device: $ip ($mac) - ${device.getString("model")}")
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing SADP response", e)
        }
    }

    private fun getElementText(parent: Element, tagName: String): String? {
        val nodeList = parent.getElementsByTagName(tagName)
        return if (nodeList.length > 0) {
            nodeList.item(0).textContent?.trim()
        } else {
            null
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, params)
    }

    private fun sendStatusEvent(status: String, message: String) {
        val params = Arguments.createMap().apply {
            putString("status", status)
            putString("message", message)
        }
        sendEvent("onDiscoveryStatus", params)
    }

    override fun invalidate() {
        super.invalidate()
        isDiscovering = false
        discoveryJob?.cancel()
        socket?.close()
        scope.cancel()
    }
}
