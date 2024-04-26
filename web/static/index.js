function signed(money) {
  if (money < 0) {
    return money.toFixed(2);
  } else {
    return `+${money.toFixed(2)}`;
  }
}

(function () {
  class IdeaComponent extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      const template = document.getElementById("idea-template");
      const content = template.content.cloneNode(true);

      this.by = this.getAttribute("by");
      this.openDate = this.getAttribute("opendate");
      this.deadline = this.getAttribute("deadline");

      let ideainfo = content.querySelector(".ideainfo");
      if (this.openDate) {
        let el = document.createElement("position-info");
        el.setAttribute("name", "Дата открытия");
        el.setAttribute("value", this.openDate);

        ideainfo.appendChild(el);
      }

      if (this.openDate) {
        let el = document.createElement("position-info");
        el.setAttribute("name", "Срок идеи");
        el.setAttribute("value", this.deadline);

        ideainfo.appendChild(el);
      }

      content.querySelector(".by").innerText = `by ${this.by}`;

      this.appendChild(content);
    }
  }

  customElements.define("idea-component", IdeaComponent);
})();

(function () {
  class PositionInfo extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      const template = document.getElementById("position-info-template");
      const content = template.content.cloneNode(true);

      this.name = this.getAttribute("name");
      this.value = this.getAttribute("value");
      content.querySelector(".name").innerText = this.name;
      content.querySelector(".value").innerText = this.value;

      this.appendChild(content);
    }
  }

  customElements.define("position-info", PositionInfo);
})();

(function () {
  class PositionComponent extends HTMLElement {
    constructor() {
      super();
      this.url = this.getAttribute("url"); // get url attribute value
    }

    connectedCallback() {
      this.render();
    }

    render() {
      this.name = this.getAttribute("name");
      this.ticker = this.getAttribute("ticker");
      this.curPrice = this.getAttribute("curprice");
      this.startPrice = this.getAttribute("startprice");
      this.openDate = this.getAttribute("opendate");
      this.target = this.getAttribute("target");

      const template = document.getElementById("position-template");
      const content = template.content.cloneNode(true);

      content.querySelector(".assetname").innerText = this.name;

      content.querySelector(".ticker").innerText = this.ticker;

      let curPrice = content.querySelector(".curprice");
      let profitP =
        ((Number(this.curPrice) - Number(this.startPrice)) /
          Number(this.startPrice)) *
        100;
      curPrice.innerText = `₽${this.curPrice} (${signed(profitP)}%)`;

      let posInfo = content.querySelector(".posinfo");
      if (this.openDate) {
        let el = document.createElement("position-info");
        el.setAttribute("name", "Открыто");
        el.setAttribute("value", this.openDate);

        posInfo.appendChild(el);
      }

      if (this.startPrice) {
        let el = document.createElement("position-info");
        el.setAttribute("name", "Цена открытия");
        el.setAttribute("value", `₽${this.startPrice}`);

        posInfo.appendChild(el);
      }

      if (this.target) {
        let el = document.createElement("position-info");
        el.setAttribute("name", "Цель");
        el.setAttribute("value", `₽${this.target}`);

        posInfo.appendChild(el);

        let upsideP =
          ((Number(this.target) - Number(this.curPrice)) /
            Number(this.curPrice)) *
          100;
        let el1 = document.createElement("position-info");
        el1.setAttribute("name", "Апсайд");
        el1.setAttribute(
          "value",
          `₽${Number(this.target - this.curPrice).toFixed(2)} (${signed(upsideP)}%)`,
        );

        posInfo.appendChild(el1);
      }

      this.appendChild(content);
    }

    fetchData() {
      fetch(this.url)
        .then((response) => response.json())
        .then((data) => {
          // update state with fetched data
          this.state = data;
          this.render();
        })
        .catch((error) => console.error("Error fetching data:", error));
    }
  }

  customElements.define("position-component", PositionComponent);
})();
