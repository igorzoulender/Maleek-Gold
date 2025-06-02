 (function () {
      // URL originale de l'API or.fr
      const ORIGINAL_API_URL =
        'https://or.fr/api/spot-prices?metal=XAU&currency=XOF&weight_unit=oz&boundaries=1';
      // Proxy AllOrigins (raw) pour contourner CORS
      const PROXY_URL =
        'https://api.allorigins.win/raw?url=' +
        encodeURIComponent(ORIGINAL_API_URL);

      // Sélection des éléments DOM
      const currentPriceEl = document.getElementById('current-price');
      const tableBodyEl = document.getElementById('data-table-body');
      const ctx = document.getElementById('priceChart').getContext('2d');

      // Variables Chart.js
      let chart;
      const labels = []; // timestamps ISO
      const dataMidValues = []; // valeurs mid

      // Initialise le graphique Chart.js
      function initChart() {
        chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Valeur (mid) en XOF/oz',
                data: dataMidValues,
                borderColor: '#FFD700',
                backgroundColor: 'rgba(255, 215, 0, 0.2)',
                tension: 0.2,
                pointRadius: 3,
                pointBackgroundColor: '#FFD700',
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: 'time',
                time: {
                  parser: "yyyy-MM-dd'T'HH:mm:ssXXX",
                  tooltipFormat: 'HH:mm:ss',
                  displayFormats: {
                    minute: 'HH:mm',
                    hour: 'HH:mm',
                  },
                },
                title: {
                  display: true,
                  text: 'Heure (UTC)',
                  color: '#FFD700',
                },
                ticks: {
                  color: '#f5f5f5',
                },
                grid: {
                  color: 'rgba(255, 215, 0, 0.2)',
                },
              },
              y: {
                title: {
                  display: true,
                  text: 'Prix (XOF)',
                  color: '#FFD700',
                },
                ticks: {
                  color: '#f5f5f5',
                },
                grid: {
                  color: 'rgba(255, 215, 0, 0.2)',
                },
              },
            },
            plugins: {
              legend: {
                labels: {
                  color: '#f5f5f5',
                },
              },
              tooltip: {
                mode: 'index',
                intersect: false,
                titleColor: '#FFD700',
                bodyColor: '#f5f5f5',
                backgroundColor: '#1c1c1c',
                borderColor: '#FFD700',
                borderWidth: 1,
              },
            },
          },
        });
      }

      /**
       * Met à jour la carte “Prix courant (mid)”, le graphique et le tableau.
       * items : tableau d’objets renvoyés par l’API, chacun avec { date, ask, mid, bid, performance, ... }
       */
      function updateUI(items) {
        // 1) Calculer le timestamp UTC arrondi à la tranche de 5 minutes la plus basse
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth();
        const day = now.getUTCDate();
        const hour = now.getUTCHours();
        const minute = now.getUTCMinutes();
        // Tronquer vers le bas, au multiple de 5
        const minuteTrunc = Math.floor(minute / 5) * 5;
        // Construire un objet Date UTC à ce moment
        const utcTrunc = new Date(Date.UTC(year, month, day, hour, minuteTrunc, 0));
        // "2025-06-02T14:10:00Z" => "2025-06-02T14:10:00+00:00"
        const isoNoMs = utcTrunc.toISOString().split('.')[0]; // ex: "2025-06-02T14:10:00Z"
        const targetTimestamp = isoNoMs.replace('Z', '+00:00');

        // 2) Filtrer tous les items valides (ayant un "mid") ET dont date ≤ targetTimestamp
        //    puis trier par date décroissante, et prendre le premier.
        const candidates = items
          .filter(itm => typeof itm.mid === 'number')
          .map(itm => {
            return {
              date: itm.date,
              dateMs: new Date(itm.date).getTime(),
              mid: itm.mid,
              performance: itm.performance,
            };
          })
          .filter(obj => {
            // transformer targetTimestamp en millisecondes
            const targetMs = new Date(targetTimestamp).getTime();
            return obj.dateMs <= targetMs;
          })
          .sort((a, b) => b.dateMs - a.dateMs);

        let chosenItem = null;
        if (candidates.length > 0) {
          chosenItem = candidates[0];
        } else {
          // Si aucun candidat n’existe (p. ex. l’API n’a pas encore publié la tranche actuelle),
          // on prend le tout premier item non-undefined
          const fallback = items.find(itm => typeof itm.mid === 'number');
          if (fallback) {
            chosenItem = {
              date: fallback.date,
              dateMs: new Date(fallback.date).getTime(),
              mid: fallback.mid,
              performance: fallback.performance,
            };
          }
        }

        // Affichage dans la carte
        if (chosenItem) {
          currentPriceEl.textContent = chosenItem.mid.toLocaleString('fr-FR') + ' XOF';
        } else {
          currentPriceEl.textContent = '–';
        }

        // 3) Mettre à jour le graphique (derniers 10 points)
        items.forEach(item => {
          if (typeof item.mid === 'number') {
            labels.push(item.date);
            dataMidValues.push(item.mid);
          }
        });
        if (labels.length > 10) {
          labels.splice(0, labels.length - 10);
          dataMidValues.splice(0, dataMidValues.length - 10);
        }
        chart.update();

        // 4) Mettre à jour le tableau synthétique (5 dernières lignes)
        tableBodyEl.innerHTML = '';
        items
          .slice(-5)
          .reverse()
          .forEach(item => {
            const tr = document.createElement('tr');

            // Date
            const tdDate = document.createElement('td');
            tdDate.textContent = new Date(item.date)
              .toISOString()
              .replace('T', ' ')
              .slice(0, 19);
            tr.appendChild(tdDate);

            // Ask
            const tdAsk = document.createElement('td');
            tdAsk.textContent =
              typeof item.ask === 'number'
                ? item.ask.toLocaleString('fr-FR')
                : '—';
            tr.appendChild(tdAsk);

            // Mid
            const tdMid = document.createElement('td');
            tdMid.textContent =
              typeof item.mid === 'number'
                ? item.mid.toLocaleString('fr-FR')
                : '—';
            tr.appendChild(tdMid);

            // Bid
            const tdBid = document.createElement('td');
            tdBid.textContent =
              typeof item.bid === 'number'
                ? item.bid.toLocaleString('fr-FR')
                : '—';
            tr.appendChild(tdBid);

            // Performance
            const tdPerf = document.createElement('td');
            if (typeof item.performance === 'number') {
              tdPerf.textContent = item.performance.toFixed(2) + ' %';
              tdPerf.style.color =
                item.performance > 0
                  ? '#4caf50'
                  : item.performance < 0
                  ? '#f44336'
                  : '#f5f5f5';
            } else {
              tdPerf.textContent = '—';
              tdPerf.style.color = '#f5f5f5';
            }
            tr.appendChild(tdPerf);

            tableBodyEl.appendChild(tr);
          });
      }

      // Fetch des données via le proxy (AllOrigins/raw) et maj de l’UI
      async function fetchDataAndUpdate() {
        try {
          const response = await fetch(PROXY_URL);
          if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
          const json = await response.json();

          const items = Array.isArray(json._embedded?.items)
            ? json._embedded.items
            : [];
          if (items.length === 0) return;
          updateUI(items);
        } catch (err) {
          console.error(
            'Impossible de récupérer les données via le proxy :',
            err
          );
        }
      }

      // Initialisation au chargement de la page
      document.addEventListener('DOMContentLoaded', () => {
        initChart();
        fetchDataAndUpdate();
        // Rafraîchissement automatique toutes les 60 s
        setInterval(fetchDataAndUpdate, 60 * 1000);
      });
    })();