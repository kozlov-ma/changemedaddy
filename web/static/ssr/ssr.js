/**
 * @param {Element} elt
 */
function ssrize(elt) {
  const VERBS = ["get", "post", "patch"];

  for (const verb of VERBS) {
    const haveVerbs = elt.querySelectorAll(`[ssr-${verb}]`);

    for (const verbEl of haveVerbs) {
      const url = verbEl.getAttribute(`ssr-${verb}`);

      switch (verbEl.tagName) {
        case "FORM":
          const form = verbEl;
          form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const formData = new FormData(form);

            if (verb === "get") {
              console.error("form cannot have an ssr-get attribute");
              return false;
            }

            try {
              const response = await fetch(url, {
                method: verb.toUpperCase(),
                body: formData,
              });

              const responseText = await response.text();

              const parser = new DOMParser();
              const responseDoc = parser.parseFromString(
                responseText,
                "text/html",
              );

              const newNode = responseDoc.body;

              swapTarget(newNode, form);
            } catch (err) {
              console.error(err);
            }

            return false; // to prevent redirection
          });
          break;
        default:
          async function ssrAction() {
            if (!url) {
              console.error("Invalid URL");
              return;
            }

            try {
              const response = await fetch(url, {
                method: verb.toUpperCase(),
              });
              const responseText = await response.text();

              const parser = new DOMParser();
              const parsedHTML = parser.parseFromString(
                responseText,
                "text/html",
              );
              const newContent = parsedHTML.body;

              swapTarget(newContent, verbEl);
            } catch (error) {
              console.error("couldn't fetch or swap target:", error);
            }
          }

          const triggerEvent = getTrigger(verbEl);
          if (
            triggerEvent === "load" &&
            (document.readyState === "interactive" ||
              document.readyState === "complete")
          ) {
            ssrAction();
          } else if (triggerEvent) {
            verbEl.addEventListener(triggerEvent, ssrAction);
          }
      }
    }
  }
}

function getTrigger(elt) {
  let triggerEvent;
  const triggerAttr = elt.getAttribute("ssr-trigger");
  if (!triggerAttr) {
    switch (elt.tagName) {
      case "BUTTON":
        triggerEvent = "click";
        break;
      case "FORM":
        triggerEvent = "submit";
        break;
      default:
        console.error("unspecified trigger for", elt.tagName);
        return null;
    }
  } else {
    triggerEvent = triggerAttr;
  }

  return triggerEvent;
}

function swapTarget(toSwap, targetFrom) {
  const targetSelector = targetFrom.getAttribute("ssr-target");
  let targetElement;
  if (!targetSelector || targetSelector === "this") {
    targetElement = targetFrom;
  } else if (targetSelector.startsWith("closest")) {
    const closestSelector = targetSelector.replace("closest", "").trim();
    targetElement = targetFrom.closest(closestSelector);
  } else {
    targetElement = document.querySelector(targetSelector);
  }

  const swapAttr = targetFrom.getAttribute("ssr-swap");

  ssrize(toSwap);
  if (swapAttr === "beforebegin") {
    targetElement.insertAdjacentElement("beforebegin", toSwap);
  } else if (swapAttr === "afterend") {
    targetElement.insertAdjacentElement("afterend", toSwap);
  } else {
    targetElement.replaceWith(toSwap);
  }

  return targetElement;
}

(function () {
  ssrize(document.body);
})();
