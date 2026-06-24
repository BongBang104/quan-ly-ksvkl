import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService }     from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/ws' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) { client.disconnect(); return; }
    try {
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.role   = payload.role;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  // Broadcast a notification to all connected clients
  broadcastNotification(event: string, payload: unknown) {
    this.server.emit(event, payload);
  }

  // Client can subscribe to a specific team room
  @SubscribeMessage('joinTeam')
  handleJoinTeam(@MessageBody() team: string, @ConnectedSocket() client: Socket) {
    client.join(`team:${team}`);
  }

  broadcastToTeam(team: string, event: string, payload: unknown) {
    this.server.to(`team:${team}`).emit(event, payload);
  }
}
