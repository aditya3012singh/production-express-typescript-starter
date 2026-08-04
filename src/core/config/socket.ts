import { Server } from 'socket.io';

class SocketConfig {
    static io: Server | null = null;

    static setIo(io: Server): void {
        this.io = io;
    }

    static emitToRoom(room: string, event: string, data: any): void {
        if (!this.io) {
            return;
        }
        this.io.to(room).emit(event, data);
    }
}

export default SocketConfig;
