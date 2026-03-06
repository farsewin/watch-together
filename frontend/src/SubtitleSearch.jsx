import { useState, useEffect } from 'react';
import axios from 'axios';

const SubtitleSearch = ({ tmdbId, type, season, episode, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getBackendUrl = () => {
    return import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
  };

  const searchSubtitles = async (searchParams = {}) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${getBackendUrl()}/api/subtitles/search`, {
        params: {
          tmdb_id: tmdbId,
          type: type,
          season: season,
          episode: episode,
          q: query,
          ...searchParams
        }
      });
      setResults(response.data.data || []);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to load subtitles');
    } finally {
      setLoading(false);
    }
  };

  // Initial search if tmdbId is available
  useEffect(() => {
    if (tmdbId) {
      searchSubtitles();
    }
  }, [tmdbId, type, season, episode]);

  const handleDownload = async (fileId) => {
    setLoading(true);
    try {
      const response = await axios.post(`${getBackendUrl()}/api/subtitles/download`, {
        file_id: fileId
      });
      
      const downloadLink = response.data.link;
      // We pass it THROUGH our subtitle-vtt proxy to ensure it works (SRT conversion etc)
      const proxiedUrl = `${getBackendUrl()}/subtitle-vtt?url=${encodeURIComponent(downloadLink)}`;
      onSelect(proxiedUrl);
      setResults([]); // Close results
    } catch (err) {
      console.error('Download error:', err);
      const detailedError = err.response?.data?.details?.message || err.response?.data?.error || 'Failed to get subtitle link';
      setError(detailedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subtitle-search-container">
      <div className="search-box">
        <input 
          type="text" 
          placeholder="Search subtitles (e.g. Inception 2010)" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchSubtitles()}
        />
        <button onClick={() => searchSubtitles()} disabled={loading}>
          {loading ? '...' : '🔍 Search OS'}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {results.length > 0 && (
        <div className="subtitle-results-overlay">
          <div className="results-header">
            <h3>Subtitles Found ({results.length})</h3>
            <button onClick={() => setResults([])}>×</button>
          </div>
          <div className="results-list">
            {results.map((sub) => (
              <div key={sub.id} className="subtitle-item" onClick={() => handleDownload(sub.attributes.files[0].file_id)}>
                <span className="lang-badge">{sub.attributes.language.toUpperCase()}</span>
                <span className="sub-title">{sub.attributes.release}</span>
                <span className="dl-count">📥 {sub.attributes.download_count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .subtitle-search-container {
          position: relative;
          width: 100%;
          margin: 10px 0;
        }
        .search-box {
          display: flex;
          gap: 8px;
        }
        .search-box input {
          flex: 1;
          padding: 10px;
          border-radius: 4px;
          border: 1px solid #333;
          background: #222;
          color: white;
        }
        .search-box button {
          padding: 8px 15px;
          border-radius: 4px;
          border: none;
          background: #e50914;
          color: white;
          cursor: pointer;
          font-weight: bold;
        }
        .subtitle-results-overlay {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          z-index: 100;
          max-height: 300px;
          overflow-y: auto;
          box-shadow: 0 10px 30px rgba(0,0,0,0.8);
          margin-top: 5px;
        }
        .results-header {
          padding: 10px 15px;
          border-bottom: 1px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #222;
          position: sticky;
          top: 0;
        }
        .results-header h3 { margin: 0; font-size: 0.9rem; color: #999; }
        .results-header button { background: none; border: none; color: #666; font-size: 1.5rem; cursor: pointer; }
        
        .subtitle-item {
          padding: 12px 15px;
          border-bottom: 1px solid #222;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: background 0.2s;
        }
        .subtitle-item:hover { background: #333; }
        .lang-badge {
          background: #444;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.7rem;
          font-weight: bold;
          color: #fff;
        }
        .sub-title { flex: 1; font-size: 0.85rem; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dl-count { font-size: 0.75rem; color: #666; }
        .error-text { color: #ff0000; font-size: 0.8rem; margin: 5px 0; }
      `}</style>
    </div>
  );
};

export default SubtitleSearch;
