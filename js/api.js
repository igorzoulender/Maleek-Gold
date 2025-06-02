(function () {
      // URL originale de l'API or.fr
      const ORIGINAL_API_URL = 'https://or.fr/api/spot-prices?metal=XAU&currency=XOF&weight_unit=oz&boundaries=1';
      // Proxy AllOrigins pour contourner CORS
      const PROXY_URL = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(ORIGINAL_API_URL);

      // Récupération des éléments du DOM
      const currentPriceEl = document.getElementById('current-price');
      const tableBodyEl = document.getElementById('data-table-body');
      const ctx = document.getElementById('priceChart').getContext('2d');

      // Variables pour stocker les données du graphique
      let chart;
      const labels = [];            // Liste des timestamps ISO
      const dataMidValues = [];     // Valeurs “mid”

      // Initialisation du chart (Chart.js)
      function initChart() {
        chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Valeur (mid) en XOF/oz',
              data: dataMidValues,
              borderColor: '#FFD700',
              backgroundColor: 'rgba(255, 215, 0, 0.2)',
              tension: 0.2,
              pointRadius: 3,
              pointBackgroundColor: '#FFD700',
              borderWidth: 2,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: 'time',   // Axe temporel – nécessite le date adapter
                time: {
                  parser: "yyyy-MM-dd'T'HH:mm:ssXXX",
                  tooltipFormat: 'HH:mm:ss',
                  displayFormats: {
                    minute: 'HH:mm',
                    hour: 'HH:mm'
                  }
                },
                title: {
                  display: true,
                  text: 'Heure (UTC)',
                  color: '#FFD700'
                },
                ticks: {
                  color: '#f5f5f5'
                },
                grid: {
                  color: 'rgba(255, 215, 0, 0.2)'
                }
              },
              y: {
                title: {
                  display: true,
                  text: 'Prix (XOF)',
                  color: '#FFD700'
                },
                ticks: {
                  color: '#f5f5f5'
                },
                grid: {
                  color: 'rgba(255, 215, 0, 0.2)'
                }
              }
            },
            plugins: {
              legend: {
                labels: {
                  color: '#f5f5f5'
                }
              },
              tooltip: {
                mode: 'index',
                intersect: false,
                titleColor: '#FFD700',
                bodyColor: '#f5f5f5',
                backgroundColor: '#1c1c1c',
                borderColor: '#FFD700',
                borderWidth: 1
              }
            }
          }
        });
      }

      // Met à jour le DOM avec les nouvelles données
      function updateUI(items) {
        // 1) Mettre à jour la carte “prix courant”
        const latestItem = items.find(i => typeof i.mid === 'number');
        if (latestItem) {
          const midValue = latestItem.mid.toLocaleString('fr-FR');
          currentPriceEl.textContent = `${midValue} XOF`;
        }

        // 2) Mettre à jour le graphique (modèle “10 derniers points”)
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

        // 3) Mettre à jour le tableau synthétique (5 dernières lignes)
        tableBodyEl.innerHTML = '';
        items.slice(-5).reverse().forEach(item => {
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
          tdAsk.textContent = item.ask ? item.ask.toLocaleString('fr-FR') : '—';
          tr.appendChild(tdAsk);

          // Mid
          const tdMid = document.createElement('td');
          tdMid.textContent = item.mid ? item.mid.toLocaleString('fr-FR') : '—';
          tr.appendChild(tdMid);

          // Bid
          const tdBid = document.createElement('td');
          tdBid.textContent = item.bid ? item.bid.toLocaleString('fr-FR') : '—';
          tr.appendChild(tdBid);

          // Performance
          const tdPerf = document.createElement('td');
          tdPerf.textContent = (typeof item.performance === 'number')
                                ? `${item.performance.toFixed(2)} %`
                                : '—';
          tdPerf.style.color = item.performance > 0
                                ? '#4caf50'
                                : (item.performance < 0 ? '#f44336' : '#f5f5f5');
          tr.appendChild(tdPerf);

          tableBodyEl.appendChild(tr);
        });
      }

      // Récupération des données via le proxy pour contourner CORS
      async function fetchDataAndUpdate() {
        try {
          const response = await fetch(PROXY_URL);
          if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
          const json = await response.json();

          const items = json._embedded && Array.isArray(json._embedded.items)
                        ? json._embedded.items
                        : [];
          if (items.length === 0) return;

          updateUI(items);
        } catch (err) {
          console.error('Impossible de récupérer les données via le proxy :', err);
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