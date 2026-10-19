      (function initTibMap() {
        var el = document.getElementById('tib-map');
        if (!el || typeof L === 'undefined') return;
        var coords = [44.861306, 24.933917];
        var map = L.map(el, { center: coords, zoom: 18, minZoom: 3, maxZoom: 19, scrollWheelZoom: true, dragging: true, doubleClickZoom: true, touchZoom: true, boxZoom: true, keyboard: true, zoomControl: true, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
        L.circle(coords, { radius: 18, color: '#c8480a', weight: 3, fillColor: '#c8480a', fillOpacity: 0.35, className: 'tib-highlight-circle' }).addTo(map);
        L.circleMarker(coords, { radius: 7, color: '#ffffff', weight: 3, fillColor: '#c8480a', fillOpacity: 1 }).addTo(map).bindPopup('TIB Industry<br>Str. București-Pitești 195B');
      })();
    
