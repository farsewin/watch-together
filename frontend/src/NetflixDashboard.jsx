import React, { useState } from "react";

const NetflixDashboard = ({ onSelect }) => {
  const [tmdbId, setTmdbId] = useState("");
  const [type, setType] = useState("movie");
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!tmdbId) return;
    onSelect({ tmdbId, type, season, episode });
  };

  return (
    <div className="netflix-dashboard">
      <div className="netflix-header">
         <h1 style={{ color: '#e50914', fontSize: '2.5rem', fontWeight: 'bold' }}>NETFLIX <span style={{ color: '#fff', fontSize: '1rem' }}>WATCH PARTY</span></h1>
      </div>
      
      <div className="netflix-card">
        <h2>Select Content</h2>
        <form onSubmit={handleSubmit} className="netflix-form">
          <div className="form-group">
            <label>Media Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="movie">Movie</option>
              <option value="tv">TV Series</option>
            </select>
          </div>

          <div className="form-group">
            <label>TMDB ID</label>
            <input 
              type="text" 
              placeholder="Enter TMDB ID (e.g. 1011985)" 
              value={tmdbId} 
              onChange={(e) => setTmdbId(e.target.value)}
              required
            />
          </div>

          {type === "tv" && (
            <div className="tv-meta">
              <div className="form-group">
                <label>Season</label>
                <input 
                  type="number" 
                  min="1" 
                  value={season} 
                  onChange={(e) => setSeason(parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Episode</label>
                <input 
                  type="number" 
                  min="1" 
                  value={episode} 
                  onChange={(e) => setEpisode(parseInt(e.target.value))}
                />
              </div>
            </div>
          )}

          <button type="submit" className="netflix-btn">START WATCHING</button>
        </form>
      </div>

      <div className="netflix-hint">
        <p>Tip: You can find IDs on <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" style={{ color: '#e50914' }}>TMDB</a></p>
      </div>

      <style>{`
        .netflix-dashboard {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px;
          color: white;
          background: #141414;
          min-height: 80vh;
        }
        .netflix-card {
           background: rgba(0,0,0,0.75);
           padding: 40px;
           border-radius: 8px;
           width: 100%;
           max-width: 450px;
           box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        .netflix-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-group label {
          font-size: 0.9rem;
          color: #b3b3b3;
        }
        .netflix-form input, .netflix-form select {
          padding: 12px;
          border-radius: 4px;
          border: none;
          background: #333;
          color: white;
          font-size: 1rem;
        }
        .tv-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .netflix-btn {
          background: #e50914;
          color: white;
          border: none;
          padding: 15px;
          font-weight: bold;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1.1rem;
          margin-top: 10px;
          transition: background 0.2s;
        }
        .netflix-btn:hover {
          background: #b20710;
        }
        .netflix-hint {
          margin-top: 20px;
          color: #666;
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  );
};

export default NetflixDashboard;
