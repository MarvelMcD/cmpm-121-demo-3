// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Location of our classroom (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const MAX_COINS_PER_CACHE = 5;
const inventoryPanel = document.querySelector<HTMLDivElement>(
  "#inventoryPanel",
)!;

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("You are Here.");
playerMarker.addTo(map);

interface Cache {
  coins: Set<string>;
}

interface Inventory {
  items: Set<string>;
}

function createInventory(): Inventory {
  return { items: new Set() };
}

function addItem(inventory: Inventory, itemId: string): void {
  inventory.items.add(itemId);
}

function removeItem(inventory: Inventory, itemId: string): boolean {
  return inventory.items.delete(itemId); // Removes the item and returns `true` if it existed
}
// Not used yet
// function hasItem(inventory: Inventory, itemId: string): boolean {
//   return inventory.items.has(itemId); // Returns `true` if the item exists
// }

function renderInventory(inventory: Inventory, container: HTMLElement): void {
  container.innerHTML = `<h3>Inventory</h3><ul>`;
  for (const item of inventory.items) {
    container.innerHTML += `<li>${item}</li>`;
  }
  container.innerHTML += `</ul>`;
}

function renderCacheCoins(cache: Cache, popupDiv: HTMLElement): void {
  const cacheCoinsDiv = popupDiv.querySelector(".cache-coins")!;
  cacheCoinsDiv.innerHTML = `<h4>Cache Coins:</h4>`;
  if (cache.coins.size === 0) {
    cacheCoinsDiv.innerHTML += `<p>No coins here</p>`;
  } else {
    cacheCoinsDiv.innerHTML += `<ul>${
      Array.from(cache.coins)
        .map((coin) => `<li>${coin}</li>`)
        .join("")
    }</ul>`;
  }
}

function spawnCache(i: number, j: number, inventory: Inventory): void {
  const cache: Cache = { coins: new Set() };
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Determine how many coins this cache will spawn with
  const numberOfCoins = Math.floor(Math.random() * (MAX_COINS_PER_CACHE + 1));

  // Generate unique coin IDs and add coins to the cache
  for (let k = 0; k < numberOfCoins; k++) {
    const coinId = `coin_${i}_${j}_${k}_${
      luck(`${i},${j},coin${k}`).toString()
    }`;
    cache.coins.add(coinId); // Add the coin to the cache's set
  }

  // Bind a popup to the cache with interactive buttons
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");

    // Render the popup's layout
    popupDiv.innerHTML = `
          <div>Cache at location "${i},${j}"</div>
          <div class="cache-coins"></div>
          <button id="depositCoin">Deposit Coin</button>
          <button id="withdrawCoin">Withdraw Coin</button>
      `;

    // Display the current list of coins in the cache
    renderCacheCoins(cache, popupDiv);

    // Deposit coin logic
    popupDiv.querySelector<HTMLButtonElement>("#depositCoin")!.addEventListener(
      "click",
      () => {
        const inventoryArray = Array.from(inventory.items); // Get coins from inventory
        if (inventoryArray.length > 0) {
          const coinToDeposit = inventoryArray[0]; // Pick the first coin
          removeItem(inventory, coinToDeposit); // Remove it from inventory
          cache.coins.add(coinToDeposit); // Add it to the cache
          renderInventory(inventory, inventoryPanel); // Update inventory display
          renderCacheCoins(cache, popupDiv); // Update cache display
        } else {
          alert("No coins in your inventory to deposit!");
        }
      },
    );

    // Withdraw coin logic
    popupDiv.querySelector<HTMLButtonElement>("#withdrawCoin")!
      .addEventListener("click", () => {
        if (cache.coins.size > 0) {
          const coinToWithdraw = Array.from(cache.coins)[0]; // Pick the first coin in the cache
          cache.coins.delete(coinToWithdraw); // Remove it from the cache
          addItem(inventory, coinToWithdraw); // Add it to the inventory
          renderInventory(inventory, inventoryPanel); // Update inventory display
          renderCacheCoins(cache, popupDiv); // Update cache display
        } else {
          alert("No coins in the cache to withdraw!");
        }
      });

    return popupDiv; // Return the popup's DOM element
  });
}

// Initialize the game
function initializeGame(): void {
  const inventory = createInventory(); // Create the player's inventory
  renderInventory(inventory, inventoryPanel); // Render the initial (empty) inventory

  // Now spawn caches across the map
  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      if (luck(`${i},${j}`) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j, inventory); // Pass the inventory to each cache
      }
    }
  }
}

// Start the game
initializeGame();
