import json
import math
import uuid
from collections import defaultdict
from datetime import datetime


class ConveyorCounter:
    def __init__(
        self,
        min_seen_frames=1,
        line_ratio=0.5,      
        direction="lr",      
        cross_margin=12,     
        min_confidence=0.5,  
        fingerprint_distance: int = 48,  
        fingerprint_ttl_frames: int = 30,  
    ):
        self.min_seen_frames = min_seen_frames
        self.line_ratio = line_ratio
        self.direction = direction
        self.cross_margin = cross_margin
        self.min_confidence = min_confidence

        
        self.active_counted_ids = set()          
        self.totals = defaultdict(int)
        self.history = []
        self.started_at = datetime.now().isoformat()

        
        self.track_state = {}

        
        self.fingerprint_distance = fingerprint_distance
        self.fingerprint_ttl_frames = fingerprint_ttl_frames
        self.fingerprints = {} 
        self._frame_counter = 0

    def get_line_x(self, frame_width: int) -> int:
        return int(frame_width * self.line_ratio)

    def _side(self, cx: float, line_x: int) -> str:
        if cx < (line_x - self.cross_margin):
            return "left"
        if cx > (line_x + self.cross_margin):
            return "right"
        return "on_line"

    def update_from_active_tracks(self, active_tracks, frame_shape):
        
        _, w = frame_shape[:2]
        line_x = self.get_line_x(w)
        newly_counted = []
        self._frame_counter += 1
    
        remove_fids = []
        for fid, f in list(self.fingerprints.items()):
            if self._frame_counter - f["last_seen"] > self.fingerprint_ttl_frames:
                remove_fids.append(fid)
        for fid in remove_fids:
            self.fingerprints.pop(fid, None)
        entry_side = "left" if self.direction == "lr" else "right"
        exit_side = "right" if self.direction == "lr" else "left"

        for tr in active_tracks:
            tid = tr["id"]
            confidence = float(tr.get("conf", 0.0))
            
            
            if confidence < self.min_confidence:
                continue
            
            x1, y1, x2, y2 = tr["bbox"]
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            side = self._side(cx, line_x)

            state = self.track_state.setdefault(
                tid,
                {"class": tr["class"], "last_side": None, "last_valid_side": None, "last_cx": None, "confidence": confidence}
            )
            state["class"] = tr["class"]
            state["confidence"] = max(state["confidence"], confidence)

            if tid not in self.active_counted_ids and tr.get("seen_frames", 0) >= self.min_seen_frames:
                last_cx = state.get("last_cx")
                crossed = False
                if last_cx is not None:
                    if self.direction == "lr":
                        crossed = last_cx < (line_x - self.cross_margin) and cx > (line_x + self.cross_margin)
                    else:
                        crossed = last_cx > (line_x + self.cross_margin) and cx < (line_x - self.cross_margin)

                
                if not crossed and side != "on_line":
                    crossed = (state["last_valid_side"] == entry_side and side == exit_side)

                if crossed:
                    cls = state["class"]

                    
                    duplicate = False
                    for fid, f in self.fingerprints.items():
                        fx, fy, fcls = f["x"], f["y"], f["class"]
                        if fcls != cls:
                            continue
                        dist = math.hypot(fx - cx, fy - cy)
                        if dist <= self.fingerprint_distance:
                            
                            self.fingerprints[fid]["last_seen"] = self._frame_counter
                            duplicate = True
                            break

                    if duplicate:
                        
                        state["counted"] = True
                    else:
                        
                        self.active_counted_ids.add(tid)
                        self.totals[cls] += 1
                        event = {
                            "id": tid,
                            "class": cls,
                            "confidence": state["confidence"],
                            "timestamp": datetime.now().isoformat(),
                        }
                        self.history.append(event)
                        newly_counted.append(event)
                     
                        fid = str(uuid.uuid4())
                        self.fingerprints[fid] = {"x": cx, "y": cy, "class": cls, "last_seen": self._frame_counter}
                        state["counted"] = True

            if side != "on_line":
                state["last_side"] = side
                state["last_valid_side"] = side

            state["last_cx"] = cx

        return newly_counted

    def cleanup_finished_tracks(self, finished_tracks):
        
        for tr in finished_tracks:
            track_id = tr["id"]
            
            self.track_state.pop(track_id, None)
            
            self.active_counted_ids.discard(track_id)

      

    def get_json_report(self):
        return {
            "started_at": self.started_at,
            "generated_at": datetime.now().isoformat(),
            "total_items": int(sum(self.totals.values())),
            "totals": dict(self.totals),
            "history": self.history,
        }

    def reset(self):
        self.active_counted_ids.clear()
        self.totals.clear()
        self.history.clear()
        self.track_state.clear()
        self.started_at = datetime.now().isoformat()