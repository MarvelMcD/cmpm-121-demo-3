// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board, Cell } from "./board.ts";

// Location of our classroom (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4; // Tile size on the map
const NEIGHBORHOOD_RADIUS = 8; // How many tiles around the player are visible
const CACHE_SPAWN_PROBABILITY = 0.1;
const MAX_COINS_PER_CACHE = 5;
const inventoryPanel = document.querySelector<HTMLDivElement>(
  "#inventoryPanel",
)!;

// Interfaces
interface Coin {
  i: number;
  j: number;
  serial: string; // Unique serial ID for the coin
}

interface Cache {
  coins: Set<string>;
}

interface Inventory {
  items: Set<string>;
}

// Utility Functions
function formatCoin(coin: Coin): string {
  const serialTruncated = coin.serial.slice(0, 6); // Shorten the serial to 6 characters
  return `${coin.i}:${coin.j}#${serialTruncated}`;
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

function renderInventory(inventory: Inventory, container: HTMLElement): void {
  container.innerHTML = `<h3>Inventory</h3><ul>`;
  for (const item of inventory.items) {
    container.innerHTML += `<li>${item}</li>`; // Uses the shortened format
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
      Array.from(cache.coins).map((coin) => `<li>${coin}</li>`).join("")
    }</ul>`;
  }
}

// Create the map
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

const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("You are Here.");
playerMarker.addTo(map);

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_RADIUS);

// Function to spawn a cache in a given cell
function spawnCache(cacheCell: Cell, inventory: Inventory): void {
  const cache: Cache = { coins: new Set() }; // Create an empty cache

  // Get bounds for the cache's cell
  const bounds = board.getCellBounds(cacheCell);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Determine how many coins this cache will spawn with
  const numberOfCoins = Math.floor(Math.random() * (MAX_COINS_PER_CACHE + 1));

  // Generate unique coin IDs and add them to the cache
  for (let k = 0; k < numberOfCoins; k++) {
    const coin: Coin = {
      i: cacheCell.i,
      j: cacheCell.j,
      serial: luck(`${cacheCell.i},${cacheCell.j},coin${k}`).toString(),
    };
    cache.coins.add(formatCoin(coin)); // Use the shortened format for coins
  }

  // Bind a popup to the cache to show its coin details and allow interaction
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");

    popupDiv.innerHTML = `
          <div>Cache at location "${cacheCell.i},${cacheCell.j}"</div>
          <div class="cache-coins"></div>
          <button id="depositCoin">Deposit Coin</button>
          <button id="withdrawCoin">Withdraw Coin</button>
      `;

    renderCacheCoins(cache, popupDiv); // Display the current list of coins in the cache

    // Deposit coin logic
    popupDiv.querySelector<HTMLButtonElement>("#depositCoin")!.addEventListener(
      "click",
      () => {
        const inventoryArray = Array.from(inventory.items); // Get coins from inventory
        if (inventoryArray.length > 0) {
          const coinToDeposit = inventoryArray[0];
          removeItem(inventory, coinToDeposit);
          cache.coins.add(coinToDeposit);
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
          cache.coins.delete(coinToWithdraw);
          addItem(inventory, coinToWithdraw);
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
  const inventory = createInventory();
  renderInventory(inventory, inventoryPanel);

  // Determine all visible cells near the starting position
  const visibleCells = board.getCellsNearPoint(OAKES_CLASSROOM);

  // Spawn caches in some of the visible cells
  for (const cell of visibleCells) {
    if (luck(`${cell.i},${cell.j}`) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cell, inventory);
    }
  }
}

// Start the game
initializeGame();
