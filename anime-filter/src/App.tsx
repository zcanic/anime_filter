import { useEffect, useState, useMemo } from "react";
import { AnimeGrid, AnimeData } from "./interface-template/components/anime-grid";
import Papa from "papaparse";
import { loadUserLogs, saveUserLogs, deleteUserLog, clearAllUserLogs, SimpleUserAction } from "./lib/api";

function App() {
  const [data, setData] = useState<AnimeData[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Full log history - Single Source of Truth
  const [userLogs, setUserLogs] = useState<SimpleUserAction[]>([]);

  // Derived state (Memoized)
  // We process logs in order. Later logs overwrite earlier logs for the same ID.
  const { watchedIds, interestedIds, skippedIds } = useMemo(() => {
    const statusMap = new Map<number, string>();
    
    userLogs.forEach(log => {
      statusMap.set(Number(log.subject_id), log.status);
    });

    const watched: number[] = [];
    const interested: number[] = [];
    const skipped: number[] = [];

    statusMap.forEach((status, id) => {
      if (status === "watched") watched.push(id);
      else if (status === "interested") interested.push(id);
      else if (status === "skipped") skipped.push(id);
    });

    return { 
      watchedIds: watched, 
      interestedIds: interested, 
      skippedIds: skipped 
    };
  }, [userLogs]);

  // Derived Set for O(1) lookups - crucial for performance and sync
  const reviewedSet = useMemo(() => {
    return new Set([...watchedIds, ...interestedIds, ...skippedIds]);
  }, [watchedIds, interestedIds, skippedIds]);

  // 1. Fetch Anime Data
  useEffect(() => {
    fetch("/full_data.csv")
      .then((response) => response.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true, 
          skipEmptyLines: true,
          complete: (results) => {
            const parsedData = results.data.map((row: any) => {
              let episodes = 1;
              if (row.infobox_raw) {
                const match = row.infobox_raw.match(/话数:\s*(\d+)/);
                if (match) {
                  episodes = parseInt(match[1], 10);
                }
              }

              return {
                id: row.subject_id,
                title: String(row.title),
                japaneseTitle: String(row.supp_title || row.title),
                score: row.平均分,
                image: row.img_url,
                synopsis: "No synopsis available",
                episodes: episodes,
                year: row.year,
                // KEEP RAW STRING for fuzzy search (user requirement)
                tags: row.tags ? String(row.tags) : "",
              };
            }).filter((a: any) => a.id && a.title);

            setData(parsedData as AnimeData[]);
          },
          error: (error: any) => {
            console.error("Error parsing CSV:", error);
          }
        });
      })
      .catch(err => {
        console.error("Error fetching CSV:", err);
      });
  }, []);

  // 2. Fetch User Logs
  useEffect(() => {
    const initUserLogs = async () => {
      const logs = await loadUserLogs();
      // Map UserAnimeData to SimpleUserAction for consistency
      const simpleLogs: SimpleUserAction[] = logs.map(l => ({
        subject_id: l.subject_id,
        status: l.status,
        timestamp: l.marked_at
      }));
      
      setUserLogs(simpleLogs);
      setLoading(false);
    };

    initUserLogs();
  }, []);

  const handleAction = (ids: number[], status: string) => {
    const timestamp = new Date().toISOString();
    const newActions: SimpleUserAction[] = ids.map(id => ({
      subject_id: id,
      status,
      timestamp
    }));

    // 1. Optimistic Update - Functional Update to prevent race conditions
    setUserLogs(prev => [...prev, ...newActions]);

    // 2. Save to Backend
    saveUserLogs(newActions);
  };

  if (loading || data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F7F9F8] text-[#2C3639]">
        <div className="flex flex-col items-center gap-2">
            <span className="text-xl font-medium">Loading anime data...</span>
            <span className="text-sm text-gray-500">Parsing logs and records</span>
        </div>
      </div>
    );
  }

  const handleUndoAction = (id: number) => {
    // 1. Optimistic Update: Remove the LAST instance of this ID from logs
    setUserLogs(prev => {
      // Find the last index of this ID
      let foundIndex = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].subject_id === id) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex !== -1) {
        const newLogs = [...prev];
        newLogs.splice(foundIndex, 1);
        return newLogs;
      }
      return prev;
    });
      
    // 2. Update Backend
    deleteUserLog(id);
  };

  const handleResetAll = () => {
    // 1. Optimistic Update
    setUserLogs([]);
    
    // 2. Update Backend
    clearAllUserLogs();
  };

  return (
    <AnimeGrid
      data={data}
      watchedIds={watchedIds}
      interestedIds={interestedIds}
      skippedIds={skippedIds}
      reviewedSet={reviewedSet} // Pass the Set directly for fuzzy Logic
      page={page}
      onPrevious={() => setPage(p => Math.max(1, p - 1))}
      
      onSubmit={(selectedIds) => {
        handleAction(selectedIds, "watched");
        setPage(p => p + 1);
      }}
      
      onSkip={() => {
        setPage(p => p + 1);
      }}
      
      onMarkInterested={(id) => {
         handleAction([id], "interested");
      }}

      onMarkWatched={(id) => {
        handleAction([id], "watched");
      }}
      
      onIgnore={(ids) => {
        handleAction(ids, "skipped");
      }}

      onUndoAction={handleUndoAction}
      onResetAll={handleResetAll}
    />
  );
}

export default App;
