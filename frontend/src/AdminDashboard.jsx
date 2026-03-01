import { useState, useEffect } from "react";
import socket, { saveToken, clearSession, getToken } from "./socket";

const AdminDashboard = () => {
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [error, setError] = useState("");

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

  const fetchRooms = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/list-rooms`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      console.error("Error fetching rooms:", err);
    }
  };

  useEffect(() => {
    const token = getToken();
    if (token) {
      setIsLoggedIn(true);
      if (!socket.connected) socket.connect();
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchRooms();
      const interval = setInterval(fetchRooms, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        saveToken(data.token);
        setIsLoggedIn(true);
        setError("");
        if (!socket.connected) socket.connect();
      } else {
        setError("Invalid Admin Password");
      }
    } catch (err) {
      setError("Server connection failed");
    }
  };

  const deleteRoom = async (roomId) => {
    if (!window.confirm(`Are you sure you want to delete room ${roomId}?`)) return;
    const token = getToken();
    try {
      const res = await fetch(`${BACKEND_URL}/admin/delete-room/${roomId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        fetchRooms();
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const sendBroadcast = () => {
    if (!broadcastMsg.trim()) return;
    socket.emit("admin-broadcast", { message: broadcastMsg });
    setBroadcastMsg("");
    alert("Broadcast sent!");
  };

  const initPublic = async () => {
    const token = getToken();
    try {
      await fetch(`${BACKEND_URL}/admin/init-public`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      fetchRooms();
    } catch (err) {
      console.error("Init public failed", err);
    }
  };

  const handleLogout = () => {
    clearSession();
    setIsLoggedIn(false);
    socket.disconnect();
  };

  if (!isLoggedIn) {
    return (
      <div className="admin-login-container">
        <div className="admin-card">
          <h2>Admin Terminal Access</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter Admin Key"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input"
              autoFocus
            />
            <button type="submit" className="admin-btn">AUTHORIZE</button>
            {error && <p className="admin-error">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>ROOT ADMIN PANEL</h1>
        <button className="admin-logout" onClick={handleLogout}>LOGOUT</button>
      </header>

      <div className="admin-grid">
        <section className="admin-section admin-broadcast">
          <h3>System Broadcast</h3>
          <div className="admin-flex">
            <input
              type="text"
              placeholder="Global Alert Message..."
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              className="admin-input"
            />
            <button onClick={sendBroadcast} className="admin-btn neon-blue">SEND ALERT</button>
          </div>
        </section>

        <section className="admin-section admin-rooms">
          <div className="admin-flex-between">
            <h3>Active Systems ({rooms.length})</h3>
            <button onClick={initPublic} className="admin-btn-small">RE-INIT PUBLIC</button>
          </div>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Room ID</th>
                  <th>Name</th>
                  <th>Users</th>
                  <th>Persistent</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.roomId}>
                    <td>{room.roomId}</td>
                    <td>{room.name}</td>
                    <td>{room.userCount}</td>
                    <td>{room.persistent ? "YES" : "NO"}</td>
                    <td>
                      <button 
                        onClick={() => deleteRoom(room.roomId)}
                        className="admin-btn-danger"
                      >
                        TERMINATE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
