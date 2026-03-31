import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_URL } from '../api/client'

export function useAlertSocket(onMessage) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const reconnectRef = useRef(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    try {
      console.log('[WebSocket] Connecting to:', WS_URL)
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WebSocket] Connected')
        setConnected(true)
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current)
          reconnectRef.current = null
        }
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          console.log('[WebSocket] Message received:', msg)
          onMessageRef.current?.(msg)
        } catch (err) {
          console.error('[WebSocket] Parse error:', err)
        }
      }

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected, attempting reconnect in 3s')
        setConnected(false)
        reconnectRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err)
        ws.close()
      }
    } catch (err) {
      console.error('[WebSocket] Connection error:', err)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected }
}
