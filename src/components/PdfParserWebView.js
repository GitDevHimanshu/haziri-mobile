import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    function isDay(text) {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
      return days.includes(text.toLowerCase().replace(/[^a-z]/g, ''));
    }

    function isTimeRange(text) {
      const timePart = '(\\\\d{1,2}:\\\\d{2}|\\\\d{1,2}|\\\\d{3,4})';
      const pattern = new RegExp('^' + timePart + '\\\\s*-\\\\s*' + timePart + '$');
      return pattern.test(text.trim());
    }

    function normalizeDay(raw) {
      const lower = raw.trim().toLowerCase();
      if (lower.startsWith('mo')) return 'Monday';
      if (lower.startsWith('tu')) return 'Tuesday';
      if (lower.startsWith('we')) return 'Wednesday';
      if (lower.startsWith('th')) return 'Thursday';
      if (lower.startsWith('fr')) return 'Friday';
      if (lower.startsWith('sa')) return 'Saturday';
      if (lower.startsWith('su')) return 'Sunday';
      return raw;
    }

    function parseFuzzyTime(raw) {
      if (!raw) return null;
      let val = parseInt(raw, 10);
      if (isNaN(val)) return null;
      let h = 0, m = 0;
      if (raw.length >= 3) {
        m = val % 100;
        h = Math.floor(val / 100);
      } else {
        h = val;
      }
      return new Date(2024, 0, 1, h, m);
    }

    function parseTimeRange(text) {
      const clean = text.replace(/[^0-9\\-]/g, '');
      const parts = clean.split('-');
      if (parts.length !== 2) return null;
      const start = parseFuzzyTime(parts[0]);
      const end = parseFuzzyTime(parts[1]);
      if (start && end) {
        const sH = start.getHours() + (start.getHours() < 7 ? 12 : 0);
        const eH = end.getHours() + (end.getHours() < 7 ? 12 : 0);
        const now = new Date();
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), sH, start.getMinutes()),
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), eH, end.getMinutes())
        };
      }
      return null;
    }

    function parseCellContent(text) {
      let room = "";
      let cleanText = text;
      
      // Dart's exact room format constraint: 1-4 Letters, 1-4 Digits, optional 'R'
      // We add \\s* to make it bulletproof against pdfjs inserting spaces/newlines randomly
      const roomRegex = /\\b([A-Za-z]{1,4})[\\s\\-]*(\\d{1,4})[\\s\\-]*(R?)\\b/ig;
      let matches = [];
      let m;
      
      while ((m = roomRegex.exec(text)) !== null) {
        const fullMatch = m[0];
        const letters = m[1].toUpperCase();
        
        // Ensure we don't accidentally swallow standard university metadata classes
        if (letters === "GROUP" || letters === "BATCH" || letters === "BCA" || letters === "MCA" || letters === "BTECH") {
           continue; 
        }
        matches.push(fullMatch);
      }
      
      if (matches.length > 0) {
        // Strip out invisible spaces so it looks perfect: "CVR 410R" -> "CVR410R"
        room = matches.map(mStr => mStr.replace(/[\\s\\-]+/g, '').toUpperCase()).join(' / ');
        matches.forEach(mStr => {
           cleanText = cleanText.replace(mStr, '');
        });
      }

      const lines = cleanText.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
      let batch = "", subject = "", group = null;
      
      for (let line of lines) {
        if (line.includes("Group")) {
          group = line;
        } else if (line.includes("-") && !line.includes(" ")) {
          batch = line;
        } else {
          // Recreate Dart's logic: append any remaining unrecognized content to Subject
          subject = (subject + " " + line).trim();
        }
      }
      return { subject, room, batch, group };
    }

    window.parsePdfBase64 = async function(base64Data, trainerName) {
      try {
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const doc = await loadingTask.promise;
        const entries = [];

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();
          
          const viewport = page.getViewport({ scale: 1.0 });
          const pageHeight = viewport.height;

          const lines = textContent.items.map(item => {
            const tx = item.transform;
            const x = tx[4];
            const y = pageHeight - tx[5];
            const w = item.width;
            const h = item.height;
            return {
              text: item.str,
              bounds: { left: x, top: y - h, right: x + w, bottom: y, width: w, height: h }
            };
          }).filter(l => l.text.trim().length > 0);

          const fullText = lines.map(l => l.text).join(' ');
          if (!fullText.toLowerCase().includes(trainerName.trim().toLowerCase())) continue;

          let timeHeaders = [];
          let dayHeaders = [];

          for (let line of lines) {
            const t = line.text.trim();
            if (isDay(t)) dayHeaders.push(line);
            else if (isTimeRange(t)) timeHeaders.push(line);
          }

          if (timeHeaders.length > 0 && dayHeaders.length > 0) {
            timeHeaders.sort((a, b) => a.bounds.left - b.bounds.left);
            dayHeaders.sort((a, b) => a.bounds.top - b.bounds.top);

            const contentLines = lines.filter(line => {
              return !timeHeaders.includes(line) &&
                     !dayHeaders.includes(line) &&
                     !line.text.includes('Teacher') &&
                     !line.text.includes('Timetable generated') &&
                     !line.text.includes('School of') &&
                     !/^\\d+$/.test(line.text.trim());
            });

            let cellGroups = {};
            let lastAssignedKey = null;

            for (let line of contentLines) {
              let nearestDay = null; let minDayDist = Infinity;
              for (let day of dayHeaders) {
                const dist = Math.abs(line.bounds.top - day.bounds.top);
                if (dist < minDayDist) { minDayDist = dist; nearestDay = day; }
              }

              let nearestTimeIdx = -1; let minTimeDist = Infinity;
              let lineCenter = line.bounds.left + (line.bounds.width / 2);
              for (let i = 0; i < timeHeaders.length; i++) {
                let thCenter = timeHeaders[i].bounds.left + (timeHeaders[i].bounds.width / 2);
                const dist = Math.abs(lineCenter - thCenter);
                if (dist < minTimeDist) { minTimeDist = dist; nearestTimeIdx = i; }
              }

              let key = null;
              if (nearestDay && nearestTimeIdx !== -1) {
                key = nearestDay.text + '_' + nearestTimeIdx;
              }

              if (line.text.trim().startsWith("Group") && lastAssignedKey != null) {
                key = lastAssignedKey;
              }

              if (key != null) {
                if (!cellGroups[key]) cellGroups[key] = [];
                cellGroups[key].push(line);
                lastAssignedKey = key;
              }
            }
            
            // Reconstruct shattered cells: If a column has fragments (Room/Group) but no Subject,
            // visually it belongs to the cell starting in a previous column!
            for (let day of dayHeaders) {
              let currentParentIdx = -1;
              for (let i = 0; i < timeHeaders.length; i++) {
                let key = day.text + '_' + i;
                let lines = cellGroups[key];
                if (!lines || lines.length === 0) continue;

                let hasSubject = false;
                for (let l of lines) {
                  const t = l.text.trim();
                  const roomRegex = /\\b([A-Za-z]{1,4}[\\s\\-]*\\d{1,4}[A-Za-z]?)\\b/i;
                  const isRoom = roomRegex.test(t);
                  
                  // Check exclusions
                  const up = t.toUpperCase();
                  const isExcluded = up.includes("GROUP") || up.includes("BATCH") || up.includes("BCA") || up.includes("MCA") || up.includes("BTECH") || up.includes("BE-");

                  // A Batch will have a dash, no spaces, AND typically contains numbers (like BCA-4A).
                  // Hyphenated Subjects like IP-II have no numbers, so we require a digit to classify as a Batch.
                  const isBatch = t.includes("-") && !t.includes(" ") && /\\d/.test(t);
                  const isGroup = t.toLowerCase().includes("group");
                  
                  if (!isRoom && !isBatch && !isGroup && !/^\\d+$/.test(t) && !isExcluded) {
                    hasSubject = true;
                    break;
                  }
                }

                if (hasSubject || currentParentIdx === -1) {
                  currentParentIdx = i;
                } else {
                  // Merge these fragments into the parent cell
                  let parentKey = day.text + '_' + currentParentIdx;
                  cellGroups[parentKey] = cellGroups[parentKey].concat(lines);
                  delete cellGroups[key]; // remove the standalone fragment column
                }
              }
            }

            for (const key in cellGroups) {
              const parts = key.split('_');
              const dayText = parts[0];
              if (normalizeDay(dayText) === 'Saturday') continue;
              
              const timeIdx = parseInt(parts[1], 10);
              const timeText = timeHeaders[timeIdx].text;
              let cellLines = cellGroups[key];

              try {
                const currentTimeHeader = timeHeaders[timeIdx];
                const currentRight = currentTimeHeader.bounds.right;
                
                // Sort purely vertically first
                cellLines.sort((a, b) => a.bounds.top - b.bounds.top);
                
                // Identify the top row (Subject + Room) using a strict vertical threshold (5 points)
                const topY = cellLines[0].bounds.top;
                const topRowLines = cellLines.filter(l => Math.abs(l.bounds.top - topY) <= 6);
                topRowLines.sort((a, b) => a.bounds.left - b.bounds.left); // Sort Left to Right

                let subject = "";
                let roomCode = "";

                if (topRowLines.length > 1) {
                  // Clean coordinate separation: Rightmost is Room, everything else is Subject
                  roomCode = topRowLines[topRowLines.length - 1].text.trim();
                  subject = topRowLines.slice(0, topRowLines.length - 1).map(l => l.text.trim()).join(' ');
                } else if (topRowLines.length === 1) {
                  // Fallback: If pdfjs mashed them into a single string, safely split using explicit prefixes
                  const txt = topRowLines[0].text;
                  const fallbackRegex = /\\b(?:RJ|CVR|CL|KLM|A|B|C|D)[\\s\\-]*\\d{1,4}[A-Za-z]?\\b/i;
                  const roomMatch = txt.match(fallbackRegex);
                  if (roomMatch && txt.length > roomMatch[0].length) {
                    roomCode = roomMatch[0];
                    subject = txt.replace(roomCode, '').trim();
                  } else {
                    subject = txt;
                  }
                }

                // Any lines physically below the top row are Batch and Group
                const remainingLines = cellLines.filter(l => !topRowLines.includes(l));
                remainingLines.sort((a, b) => a.bounds.top - b.bounds.top);
                
                let batch = "";
                let group = null;

                for (let l of remainingLines) {
                  const t = l.text.trim();
                  if (t.toLowerCase().includes("group")) {
                    group = t;
                  } else {
                    batch += (batch ? " " : "") + t;
                  }
                }

                if (subject || batch) {
                  const timeRange = parseTimeRange(timeText);
                  if (timeRange) {
                    // Calculate duration dynamically based on rightmost content intersecting columns
                    const contentRightEdge = cellLines.reduce((max, l) => Math.max(max, l.bounds.right), 0);
                    let endIdx = timeIdx;
                    for (let i = timeIdx + 1; i < timeHeaders.length; i++) {
                       if (contentRightEdge > timeHeaders[i].bounds.left + 20) {
                          endIdx = i;
                       }
                    }
                    const durationMinutes = (endIdx - timeIdx + 1) * 50;
                    const endTime = new Date(timeRange.start.getTime() + durationMinutes * 60000);

                    const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                    entries.push({
                      dayOfWeek: normalizeDay(dayText),
                      startTime: timeRange.start.toISOString(),
                      endTime: endTime.toISOString(),
                      timeRange: formatter.format(timeRange.start) + ' - ' + formatter.format(endTime),
                      subject: subject,
                      roomCode: roomCode,
                      batch: batch,
                      group: group
                    });
                  }
                }
              } catch (cellGroupError) {
                 // Safely ignore individual cell parsing bugs so it doesn't freeze the whole process
                 console.error(cellGroupError);
              }
            }
            if (entries.length > 0) break;
          }
        }
        
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SUCCESS', entries }));
      } catch (e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.message || String(e) }));
      }
    };
  </script>
</head>
<body></body>
</html>
`;

export default forwardRef(function PdfParserWebView({ onResult, onError }, ref) {
  const webViewRef = useRef(null);

  useImperativeHandle(ref, () => ({
    parsePdf: (base64Data, trainerName) => {
      const safeTrainerName = trainerName.replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(`
        window.parsePdfBase64('${base64Data}', '${safeTrainerName}');
        true;
      `);
    }
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'SUCCESS') onResult(data.entries);
            else if (data.type === 'ERROR') onError(new Error(data.message));
          } catch (e) {
            onError(e);
          }
        }}
        style={{ width: 0, height: 0, opacity: 0 }}
      />
    </View>
  );
});
