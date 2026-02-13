"""Simple TCP proxy: local:10010 -> 47.100.235.168:10010"""
import socket
import threading
import sys

LISTEN_HOST = '0.0.0.0'
LISTEN_PORT = 10010
REMOTE_HOST = '47.100.235.168'
REMOTE_PORT = 10010
BUFFER_SIZE = 65536

def forward(src, dst, name):
    try:
        while True:
            data = src.recv(BUFFER_SIZE)
            if not data:
                break
            dst.sendall(data)
    except Exception:
        pass
    finally:
        src.close()
        dst.close()

def handle_client(client_sock):
    try:
        remote_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        remote_sock.connect((REMOTE_HOST, REMOTE_PORT))
        t1 = threading.Thread(target=forward, args=(client_sock, remote_sock, "c->r"), daemon=True)
        t2 = threading.Thread(target=forward, args=(remote_sock, client_sock, "r->c"), daemon=True)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
    except Exception as e:
        print(f"Connection error: {e}")
        client_sock.close()

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((LISTEN_HOST, LISTEN_PORT))
    server.listen(50)
    print(f"TCP Proxy: {LISTEN_HOST}:{LISTEN_PORT} -> {REMOTE_HOST}:{REMOTE_PORT}")
    try:
        while True:
            client_sock, addr = server.accept()
            print(f"Connection from {addr}")
            t = threading.Thread(target=handle_client, args=(client_sock,), daemon=True)
            t.start()
    except KeyboardInterrupt:
        print("Shutting down")
        server.close()

if __name__ == '__main__':
    main()
