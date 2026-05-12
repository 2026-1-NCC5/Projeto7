from collections import defaultdict
import numpy as np
import math


class ObjectTracker:
    def __init__(self, max_distance=50, max_frames_missing=30, border_margin=6):
        self.next_id = 1
        self.max_distance = max_distance
        self.max_frames_missing = max_frames_missing
        self.border_margin = border_margin
        self.tracks = {}  # id -> state
        self.counted_ids = set()  # IDs já contabilizados

    @staticmethod
    def _center(bbox):
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

    def _distance(self, b1, b2):
        c1 = self._center(b1)
        c2 = self._center(b2)
        return math.hypot(c1[0] - c2[0], c1[1] - c2[1])

    def _touches_border(self, bbox, w, h):
        x1, y1, x2, y2 = bbox
        m = self.border_margin
        return x1 <= m or y1 <= m or x2 >= (w - m) or y2 >= (h - m)

    def _fully_inside(self, bbox, w, h):
        x1, y1, x2, y2 = bbox
        m = self.border_margin
        return x1 > m and y1 > m and x2 < (w - m) and y2 < (h - m)

    def update(self, detections, frame_shape):
        """
        detections: [{'bbox':[x1,y1,x2,y2], 'class':str, 'conf':float}, ...]
        return: (active_tracks, finished_tracks)
        """
        h, w = frame_shape[:2]
        finished_tracks = []
        matched_ids = set()

        # Match simples por menor distância (mesma classe)
        for det in detections:
            best_id = None
            best_dist = self.max_distance

            for tid, tr in self.tracks.items():
                if tid in matched_ids:
                    continue
                if tr["class"] != det["class"]:
                    continue
                d = self._distance(tr["bbox"], det["bbox"])
                if d < best_dist:
                    best_dist = d
                    best_id = tid

            if best_id is None:
                tid = self.next_id
                self.next_id += 1
                bbox = det["bbox"]
                self.tracks[tid] = {
                    "id": tid,
                    "class": det["class"],
                    "bbox": bbox,
                    "conf": float(det.get("conf", 0.0)),
                    "frames_missing": 0,
                    "seen_frames": 1,
                    "touched_border_start": self._touches_border(bbox, w, h),
                    "touched_border_end": self._touches_border(bbox, w, h),
                    "was_fully_inside": self._fully_inside(bbox, w, h),
                }
                matched_ids.add(tid)
            else:
                tr = self.tracks[best_id]
                tr["bbox"] = det["bbox"]
                tr["conf"] = float(det.get("conf", tr.get("conf", 0.0)))
                tr["frames_missing"] = 0
                tr["seen_frames"] += 1
                tr["touched_border_end"] = self._touches_border(det["bbox"], w, h)
                if self._fully_inside(det["bbox"], w, h):
                    tr["was_fully_inside"] = True
                matched_ids.add(best_id)

        # Atualiza missing e finaliza tracks perdidos
        for tid in list(self.tracks.keys()):
            if tid not in matched_ids:
                self.tracks[tid]["frames_missing"] += 1
                if self.tracks[tid]["frames_missing"] > self.max_frames_missing:
                    finished_tracks.append(self.tracks.pop(tid))

        active_tracks = list(self.tracks.values())
        return active_tracks, finished_tracks

    def flush(self):
        """Finaliza todos os tracks (ao encerrar)."""
        finished = list(self.tracks.values())
        self.tracks.clear()
        return finished

    def count_unique(self, track_id):
        """Marca um objeto como contabilizado (passou pela linha)"""
        if track_id not in self.counted_ids:
            self.counted_ids.add(track_id)
            return True
        return False

    def get_counts(self):
        """Retorna contagem por classe dos objetos que passaram"""
        counts = defaultdict(int)
        for track_id in self.counted_ids:
            # Recuperar classe do histórico (simplificado)
            counts['total'] += 1
        return dict(counts)

    def reset(self):
        """Limpar histórico"""
        self.counted_ids.clear()
        self.tracks.clear()