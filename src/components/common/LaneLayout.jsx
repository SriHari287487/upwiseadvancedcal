// Put these near your ScheduleGrid component (same file or a utils file)

// Assumes parseToMinutes(str) exists and returns minutes from midnight

// import { parseToMinutes } from "../Calendar/calendar";
export function layoutLanes(rawEvents, parseToMinutes) {
  // Convert to a working copy with numeric times
  const evs = rawEvents
    .map(e => ({
      ...e,
      _start: parseToMinutes(e.start),
      _end:   parseToMinutes(e.end),
    }))
    .sort((a, b) => a._start - b._start || a._end - b._end);

  // Active events per lane; each item: {ev, end}
  let lanes = [];                 // array of last end minute in that lane
  let cluster = [];               // events in current overlap cluster
  const out = [];                 // {ev, lane, lanes} per event

  const closeFinished = (t) => {
    // mark lanes free if their last event ended before t
    lanes.forEach((end, i) => {
      if (end <= t) lanes[i] = null;
    });
  };

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const laneCount = Math.max(...cluster.map(x => x.lane)) + 1;
    cluster.forEach(x => x.ev.__lanes = laneCount);
    cluster.length = 0;
  };

  for (const ev of evs) {
    // free lanes that have ended before this event starts
    closeFinished(ev._start);

    // find the first free lane
    let laneIdx = lanes.findIndex(end => end === null || end === undefined);
    if (laneIdx === -1) laneIdx = lanes.length;

    // occupy lane
    lanes[laneIdx] = ev._end;

    // add to current cluster
    const rec = { ev, lane: laneIdx };
    cluster.push(rec);
    out.push(rec);

    // if this event ends earliest among active, we *might* still be in cluster;
    // we flush only when all lanes are free at or before the next start
    // (handled by end-of-loop below)
  }

  // After assigning lanes, we still need each cluster's lane count.
  // Re-scan to assign clusters by sweeping the timeline.
  // Simple sweep: when the next event starts after all current ends, flush cluster.

  // Build a timeline of (time, deltaActive), then re-scan out to assign counts
  const active = [];
  lanes = []; // reuse array for "current active end times"
  let maxLaneInCluster = -1;

  // sort by start then by end
  out.sort((a, b) => a.ev._start - b.ev._start || a.ev._end - b.ev._end);
  for (let i = 0; i < out.length; i++) {
    const r = out[i];

    // remove inactive
    for (let j = active.length - 1; j >= 0; j--) {
      if (active[j].ev._end <= r.ev._start) active.splice(j, 1);
    }

    active.push(r);
    maxLaneInCluster = Math.max(maxLaneInCluster, r.lane);

    const next = out[i + 1];
    const clusterEndsNow =
      !next || active.every(x => x.ev._end <= (next.ev._start));

    if (clusterEndsNow) {
      const laneCount = maxLaneInCluster + 1;
      active.forEach(x => (x.ev.__lanes = laneCount));
      active.length = 0;
      maxLaneInCluster = -1;
    }
  }

  // Return {id, lane, lanes}
  return out.map(({ ev, lane }) => ({
    id: ev.id,
    lane,
    lanes: ev.__lanes || (lane + 1),
  }));
}

// Assigns a horizontal lane to each overlapping event and the lane count
// Return shape: [{ id, lane, lanes }]
// ../common/LaneLayout.js

