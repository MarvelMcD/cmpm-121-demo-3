const app: HTMLDivElement = document.querySelector("#app")!;

const alertButton = document.createElement("button");
alertButton.textContent = "Click Me!";

alertButton.addEventListener("click", () => {
  alert("You clicked the button!");
});

app.append(alertButton);
