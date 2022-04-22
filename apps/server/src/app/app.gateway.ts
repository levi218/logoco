import { Controller, Get } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as Automerge from 'automerge';
import { AppService } from './app.service';

type EditorChanges = { offset: number; text: string }[];

interface EditorState {
  content: Automerge.Text;
}
interface Room {
  clients: string[];
  state: EditorState;
}
@WebSocketGateway({
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  rooms: { [key: string]: Room };

  constructor(private readonly appService: AppService) {
    this.rooms = {};
  }
  handleConnection(client: Socket) {
    // console.log(this.rooms);
    const roomName = client.handshake.query['roomName'] as string;
    client.join(roomName);
    if (this.rooms[roomName]) {
      // room exists
      console.log('room exists');
      this.rooms[roomName].clients.push(client.id);
      client.emit('init_document', Automerge.save(this.rooms[roomName].state));
    } else {
      console.log('room not exists');
      // room not exists, init room state
      const state = Automerge.init<EditorState>();
      const updatedState = Automerge.change<EditorState>(state, (doc) => {
        doc.content = new Automerge.Text();
        doc.content.insertAt(
          0,
          ...`
        ; Reset screen if you run it again
        cs up seth 0 setpos [0 0]
      
        up back 100 right 10 down
        make "n 1
        color "green
        repeat 18 [
            forward 200 right 10 back 200 right 10
        ]
      
        print "Done!
        
        `.replace(/\n/g, '\r\n')
        );
      });
      this.rooms[roomName] = {
        clients: [client.id],
        state: updatedState,
      };
      client.emit('init_document', Automerge.save(updatedState));
      console.log(updatedState);
    }
    console.log(this.rooms);
  }
  handleDisconnect(client: Socket) {
    console.log('disconnected', client.id);
    const roomName = client.handshake.query['roomName'] as string;
    this.rooms[roomName].clients = this.rooms[roomName].clients.filter(
      (e) => e != client.id
    );
    if (this.rooms[roomName].clients.length == 0) {
      delete this.rooms[roomName];
    }
  }

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('update_document')
  getData(
    @MessageBody() rawChanges: EditorChanges,
    @ConnectedSocket() client: Socket
  ) {
    const roomName = client.handshake.query['roomName'] as string;
    // On one node
    const newDoc = Automerge.change<EditorState>(
      this.rooms[roomName].state,
      (doc) => {
        // make arbitrary change to the document
        for (const change of rawChanges) {
          doc.content.insertAt(change.offset, ...change.text);
        }
      }
    );

    // for (const clientId of this.rooms[roomName].clients) {
    // if (clientId != client.id) {
    const binaryChange = Automerge.getChanges(
      this.rooms[roomName].state,
      newDoc
    );
    console.log(binaryChange);
    this.server.to(roomName).emit('update_document', binaryChange);
    // }
    // }
    this.rooms[roomName].state = newDoc;
  }
}
