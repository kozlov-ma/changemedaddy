(function () {
    class MyComponent extends HTMLElement {
        constructor() {
            super();
            this.state = {};
            this.url = this.getAttribute("url"); // get url attribute value
        }

        connectedCallback() {
            this.render();
        }

        render() {
            const template = document.getElementById("position-template");
            const content = template.content.cloneNode(true);
            // modify content to display state object
            this.appendChild(content);
        }

        fetchData() {
            fetch(this.url)
                .then((response) => response.json())
                .then((data) => {
                    // update state with fetched data
                    this.state = new MyData(data);
                    this.render();
                })
                .catch((error) => console.error("Error fetching data:", error));
        }
    }

    // define format for data object
    class MyData {
        constructor(data) {
            // define properties based on data
            this.property1 = data.property1;
            this.property2 = data.property2;
            // add more properties as needed
        }
    }

    customElements.define("position-component", MyComponent);
})();

(function () {
    customElements.define('target-change-card', class extends HTMLElement {
        constructor() {
            super();
            const template = document.getElementById('target-change-card-template').content;
            this.appendChild(template.cloneNode(true));

            this.querySelector('#target-date').innerText = this.getAttribute('target-date') || '10.04.2024';
            this.querySelector('#new-target-label').innerText = this.getAttribute('new-target-label') || 'Новый таргет:';
            this.querySelector('#new-target-value').innerText = this.getAttribute('new-target-value') || '₽11000';
        }
    });
})();

(function () {
    customElements.define('deadline-change-card', class extends HTMLElement {
        constructor() {
            super();
            const template = document.getElementById('deadline-change-card-template').content;
            this.appendChild(template.cloneNode(true));

            this.querySelector('#deadline-date').innerText = this.getAttribute('deadline-date') || '10.04.2024';
            this.querySelector('#new-deadline-label').innerText = this.getAttribute('new-deadline-label') || 'Новый дедлайн:';
            this.querySelector('#new-deadline-value').innerText = this.getAttribute('new-deadline-value') || 'до 30 Мая 2024';
        }
    });
})();

(function () {
    customElements.define('volume-change-card', class extends HTMLElement {
        constructor() {
            super();
            const template = document.getElementById('volume-change-card-template').content;
            this.appendChild(template.cloneNode(true));

            this.querySelector('#volume-date').innerText = this.getAttribute('volume-date') || '10.03.2024';
            this.querySelector('#change-description').innerText = this.getAttribute('change-description') || 'Позиция увеличена на';
            this.querySelector('#change-percentage').innerText = this.getAttribute('change-percentage') || '100%';
            this.querySelector('#entry-price').innerText = this.getAttribute('entry-price') || '₽7900';
        }
    });
})();
