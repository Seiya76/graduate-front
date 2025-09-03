// eventApiClient.js
import ReconnectingWebSocket from 'reconnecting-websocket'
import config from './aws-exports'

class EventAPIClient {
  constructor() {
    this.ws = null
    this.subscriptions = new Map()
    this.messageHandlers = new Map()
    this.connectionState = 'disconnected'
    
    // 設定から値を取得
    this.httpEndpoint = config.API.EventAPI.httpEndpoint
    this.wsEndpoint = config.API.EventAPI.wsEndpoint
    this.apiKey = config.API.EventAPI.apiKey
  }

  initializeWebSocket() {
    if (this.ws) return

    const headerInfo = {
      host: this.httpEndpoint.replace('https://', ''),
      'x-api-key': this.apiKey,
    }

    const encodedHeaderInfo = btoa(JSON.stringify(headerInfo))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    this.connectionState = 'connecting'
    
    this.ws = new ReconnectingWebSocket(
      `wss://${this.wsEndpoint}/event/realtime`,
      ['aws-appsync-event-ws', `header-${encodedHeaderInfo}`],
      {
        maxRetries: 5,
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1000,
      }
    )

    this.ws.onopen = () => {
      console.log('🟢 Event API WebSocket connected')
      this.connectionState = 'connected'
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      } catch (error) {
        console.error('❌ WebSocket message parse error:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
    }

    this.ws.onclose = () => {
      console.log('🔴 WebSocket connection closed')
      this.connectionState = 'disconnected'
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case 'connection_ack':
        console.log('✅ WebSocket connection acknowledged')
        break
        
      case 'data':
        try {
          const eventData = JSON.parse(data.event)
          const channelName = data.channel
          const handler = this.messageHandlers.get(channelName)
          
          if (handler) {
            handler({
              id: data.id,
              channelName,
              payload: eventData,
              timestamp: new Date()
            })
          }
        } catch (error) {
          console.error('❌ Error processing data event:', error)
        }
        break
        
      case 'error':
        console.error('❌ WebSocket event error:', data)
        break
    }
  }

  subscribeToRoomMessages(roomId, callback) {
    this.initializeWebSocket()
    
    const subscriptionId = `msg-${roomId}-${Date.now()}`
    const channelName = `/message-events/room-${roomId}`
    
    const subscribeMessage = {
      type: 'subscribe',
      id: subscriptionId,
      channel: channelName,
      authorization: {
        host: this.httpEndpoint.replace('https://', ''),
        'x-api-key': this.apiKey,
      }
    }

    const sendSubscribe = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(subscribeMessage))
        console.log(`📡 Subscribed to room messages: ${roomId}`)
      } else {
        setTimeout(sendSubscribe, 100)
      }
    }
    
    sendSubscribe()

    this.messageHandlers.set(channelName, (eventData) => {
      const message = {
        messageId: eventData.payload.messageId,
        roomId: eventData.payload.roomId,
        userId: eventData.payload.userId,
        content: eventData.payload.content,
        messageType: eventData.payload.messageType,
        timestamp: eventData.payload.timestamp,
        createdAt: eventData.payload.timestamp
      }
      callback(message)
    })
    
    this.subscriptions.set(subscriptionId, channelName)
    return subscriptionId
  }

  subscribeToRoomUpdates(callback) {
    this.initializeWebSocket()
    
    const subscriptionId = `room-updates-${Date.now()}`
    const channelName = '/room-events/channel'
    
    const subscribeMessage = {
      type: 'subscribe',
      id: subscriptionId,
      channel: channelName,
      authorization: {
        host: this.httpEndpoint.replace('https://', ''),
        'x-api-key': this.apiKey,
      }
    }

    const sendSubscribe = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(subscribeMessage))
        console.log('📡 Subscribed to room updates')
      } else {
        setTimeout(sendSubscribe, 100)
      }
    }
    
    sendSubscribe()

    this.messageHandlers.set(channelName, (eventData) => {
      const roomEvent = {
        roomId: eventData.payload.roomId,
        eventType: eventData.payload.eventType,
        userId: eventData.payload.userId,
        content: eventData.payload.content,
        timestamp: eventData.payload.timestamp
      }
      callback(roomEvent)
    })
    
    this.subscriptions.set(subscriptionId, channelName)
    return subscriptionId
  }

  unsubscribe(subscriptionId) {
    const channelName = this.subscriptions.get(subscriptionId)
    if (channelName) {
      const unsubscribeMessage = { type: 'unsubscribe', id: subscriptionId }
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(unsubscribeMessage))
      }
      
      this.messageHandlers.delete(channelName)
      this.subscriptions.delete(subscriptionId)
    }
  }

  getConnectionState() {
    return this.connectionState
  }

  close() {
    this.messageHandlers.clear()
    this.subscriptions.clear()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connectionState = 'disconnected'
  }
}

// シングルトンインスタンス
let eventApiClient = null

export const getEventAPIClient = () => {
  if (!eventApiClient) {
    eventApiClient = new EventAPIClient()
  }
  return eventApiClient
}

export default EventAPIClient