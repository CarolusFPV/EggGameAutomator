import http.server
import socketserver
import os

# Change to the directory where your script is located
os.chdir(r"C:\Users\CarolusFPV\source\github\OvipetsScript\EggGameAutomator")

# Set the port for the server
port = 8000

# Start the server
handler = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(("localhost", port), handler)

print(f"Serving on http://localhost:{port}/")
httpd.serve_forever()
