# Terminboard Live

Ein modernes, live aktualisiertes Terminboard mit SQLite-Datenbank, Admin-Panel, Bild-Uploads, jährlichen Wiederholungen und konfigurierbaren Ablauf-Aktionen.

## Start unter Windows

1. **Node.js 20 oder neuer** installieren: https://nodejs.org/
2. Diesen Ordner entpacken.
3. `start-windows.bat` doppelklicken. Beim ersten Start werden die Pakete installiert.
4. Im Browser öffnen:
   - Anzeige: http://localhost:3000/
   - Admin-Panel: http://localhost:3000/admin
5. Standard-Passwort beim ersten Start: `bitte-aendern` — unbedingt vor dem Betrieb ändern.

Zum Ändern des Passworts die Datei `start-windows.bat` bearbeiten und `set ADMIN_PASSWORD=DEIN_SICHERES_PASSWORT` eintragen. Außerdem `SESSION_SECRET` auf eine lange zufällige Zeichenfolge setzen. Anschließend den Server neu starten.

## Live-Betrieb auf einem Bildschirm

Der Server läuft dauerhaft, speichert Termine in `terminboard.sqlite` und überträgt Änderungen per Socket.IO direkt an alle offenen Anzeigen. Der Rechner, auf dem der Server läuft, muss eingeschaltet bleiben. Für den Kiosk-Betrieb im Browser kann die Anzeige unter `/` im Vollbild geöffnet werden.

- Es werden vier Termine pro Seite angezeigt.
- Die Termine sind nach dem nächsten Ablauf sortiert; der nächste Termin steht oben links.
- Die kleinen Pfeile unten rechts wechseln zwischen den Seiten.
- Ein Termin ohne jährliche Wiederholung läuft einmal ab und verschwindet danach aus der Anzeige.
- Bei „Jährlich wiederholen“ zählt das Board automatisch bis zum nächsten Vorkommen von Monat/Tag/Uhrzeit herunter; das eingetragene Jahr wird ignoriert.
- Bilder: JPG, PNG, WEBP oder GIF bis 8 MB.
- Ablaufaktionen: keine Aktion, Meldung, Ausblenden, Signalton oder zur ersten Seite wechseln.

## Im Netzwerk öffnen

Auf anderen Geräten im selben WLAN die lokale IP-Adresse des Server-PCs verwenden, z. B. `http://192.168.0.123:3000/`. Die IP-Adresse des PCs findest du unter Windows mit `ipconfig`. Nicht ungeschützt ins Internet weiterleiten; für externen Zugriff HTTPS, sichere Zugangsdaten und eine passende Proxy-/Firewall-Konfiguration einrichten.

## Daten sichern

Server stoppen und `terminboard.sqlite` sowie bei Bedarf den Ordner `uploads` kopieren. Diese beiden enthalten Termine/Einstellungen und hochgeladene Bilder.
