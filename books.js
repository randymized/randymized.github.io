function createCell(elem, inner = null, attr = {}) {
  const cell = document.createElement(elem, attr);
  if (attr) {
    Object.keys(attr).forEach((key) => cell.setAttribute(key, attr[key]));
  }
  if (inner) cell.innerHTML = inner;
  return cell;
}

function createElement(tagname, attributes, inner, listeners) {
  const el = document.createElement(tagname);
  if (attributes) {
    Object.keys(attributes).forEach((key) => {
      el.setAttribute(key, attributes[key]);
    });
  }
  if (inner) {
    if (typeof inner === "string" || inner instanceof String) {
      // the 'inner' argument is text content for the element
      el.textContent = inner;
    } else if (Array.isArray(inner)) {
      // the 'inner' argument specifies sub-elements
      if (typeof inner[0] === "string" || inner[0] instanceof String) {
        // the 'inner' argument is a single sub-element specification,
        // where the array elements are in the same order as arguments to this function
        inner = [inner];
      }
      for (const i of inner) {
        // the 'inner' argument is an array of sub-element specifications
        el.appendChild(createElement.apply(null, i));
      }
    } else if (typeof inner[Symbol.iterator] === "function") {
      // the 'inner' argument is a generator function that yields sub-elements to be appended
      for (const ie of inner) {
        el.appendChild(ie);
      }
    }
  }
  // the 'listeners' argument is an object where the keys are the names of event listeners
  // and the corresponding values are the listener functions
  if (listeners) {
    for (const ev in listeners) {
      el.addEventListener(ev, listeners[ev]);
    }
  }
  return el;
}

function dollarsAndCents(val) {
  if (!val) return ''
  var amt = `${val}`;
  var negative = "";
  if (amt.startsWith("-")) {
    negative = "-";
    amt = amt.substring(1);
  }
  switch (amt.length) {
    case 1:
      return `${negative}0.0${amt}`;
    case 2:
      return `${negative}0.${amt}`;
    case 3:
    case 4:
    case 5:
    case 6:
      return `${negative}${amt.slice(0, -2)}.${amt.slice(-2)}`;
    case 7:
    case 8:
      return `${negative}${amt.slice(0, -5)},${amt.slice(-5, -2)}.${amt.slice(
        -2
      )}`;
    default:
      return `${negative}${amt.slice(0, -8)},${amt.slice(-8, -5)},${amt.slice(
        -5,
        -2
      )}.${amt.slice(-2)}`;
  }
}

/*
 * clear out any subelements
 */
function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
  return el;
}

/*
 * clear out any previous content in the account panel
 */
function clearAccountPanel() {
  return clearElement(document.getElementById("acct-panel"));
}

function yyyymmddToDisplay(yyyymmdd) {
  return `${yyyymmdd.substring(4, 6)}/${yyyymmdd.substring(
    6,
    8
  )}/${yyyymmdd.substring(0, 4)}`;
}
class SimpleTable {
  constructor(specs) {
    this.table = createElement("table", {class: 'simpletable'}, [
      [
        "thead",
        null,
        [
          "tr",
          null,
          specs.headings.map((h) => ["th", { class: h.field }, h.text]),
        ],
      ],
      ["tbody", null],
    ]);

    this.tbody = Array.from(this.table.children).find(
      (element) => element.tagName == "TBODY"
    );
  }
  createRow(tdGenerator) {
    this.tbody.appendChild(createElement("tr", null, tdGenerator()));
  }
  appendTo(parentElement) {
    parentElement.appendChild(this.table);
  }
  getTableElement() {
    return this.table;
  }
}

function transactionPopup() {
  const myDialog = document.getElementById("myDialog");
  clearElement(myDialog);
  function transactionTable(dest, trans, level) {
    const hdrtag = `h${level + 2}`;
    dest.appendChild(
      createElement(
        hdrtag,
        null,
        trans.tdate || yyyymmddToDisplay(trans.yyyymmdd || trans.date)
      )
    );
    dest.appendChild(createElement(hdrtag, null, trans.tdescription || trans.description));
    if (trans.tpostings) {
      const jtable = new SimpleTable({
        headings: [
          { field: "acct", text: "Account" },
          { field: "amt", text: "Amount" },
          { field: "comment", text: "Comment" },
        ],
      });
      for (const j of trans.tpostings) {
        const posting= trans.allpostings[j]
        jtable.createRow(function* () {
          yield createCell("td", posting.paccount);
          yield createCell("td", dollarsAndCents(posting.pamount.aquantity.floatingPoint*100), {
              class: "rj",
            });
          yield createCell("td", posting.pcomment);
        });
      }
      jtable.appendTo(dest);
    } else if (trans.journal) {
      const jtable = new SimpleTable({
        headings: [
          { field: "acct", text: "Account" },
          { field: "debit", text: "Debit" },
          { field: "credit", text: "Credit" },
          { field: "comment", text: "Comment" },
        ],
      });
      for (const j of trans.journal) {
        jtable.createRow(function* () {
          yield createCell("td", j[0]);
          for (const n of [1, 2]) {
            yield createCell("td", dollarsAndCents(j[n]), {
              class: "rj",
            });
          }
          yield createCell("td", j[3]);
        });
      }
      jtable.appendTo(dest);
    } else if (trans.transactions) { // not in supported in hledger
      transactionTable(dest, trans.transactions, level+1)
    }

    const copyOfTrans = Object.assign({}, trans);
    delete copyOfTrans.yyyymmdd;
    delete copyOfTrans.date;
    delete copyOfTrans.journal;
    delete copyOfTrans.description;
    delete copyOfTrans.paccount;
    delete copyOfTrans.pamount;
    delete copyOfTrans.pdate;
    delete copyOfTrans.tdate;
    delete copyOfTrans.tindex;
    delete copyOfTrans.transaction;
    delete copyOfTrans.transactions;

    dest.appendChild(
      createElement("pre", null, JSON.stringify(copyOfTrans, null, 2))
    );
  }
  transactionTable(myDialog, this, 0);

  myDialog.addEventListener("click", () => myDialog.close());
  myDialog.showModal();
}

function gui(datafile) {
  const hledger= Object.hasOwn(datafile, "format") && datafile.format == 'h1'
  function onLeafClick(event) {
    // Event handler for a copy button. The text to copy
    // should be bound to this instance, so that it is referenced by `this`
    function onCopyButton() {
      navigator.clipboard.writeText(this);
    }
    function copyable(container,text, label) {
      const subelements= [
        ['span', null, text],
        ['button', {class:'copybutton'}, 'Copy', { click: onCopyButton.bind(text) }]
      ]
      if (label) subelements.push(['span', null, 'Short name: '])
      return createElement(container, null, subelements);
    }

    const accountName = datafile.accountIdList[this.accountIndex];
    const accountRecords = datafile.byAccount[accountName];
    const postings = hledger? datafile.postings : datafile.journalentries
    const transactions = datafile.transactions;

    const accountPanel = clearAccountPanel();

    accountPanel.appendChild(createElement(
      'a',{href:'#',class:'close'},'',{click:clearAccountPanel}
    ))
    accountPanel.appendChild(copyable('h2',accountName))
    if (!hledger && accountRecords.shortname) {
      accountPanel.appendChild(copyable('div',accountRecords.shortname))
    }

    const accttable = new SimpleTable({
      headings: hledger? [
        { field: "date", text: "Date" },
        { field: "amount", text: "Amount" },
        { field: "note", text: "Note" },
        { field: "trans", text: "Transaction" },
      ] : [
        { field: "date", text: "Date" },
        { field: "debit", text: "Debit" },
        { field: "credit", text: "Credit" },
        { field: "note", text: "Note" },
        { field: "trans", text: "Transaction" },
      ],
    });

    if (hledger) {
      const byPostingDate= function (a,b) {
        return a.pdate || a.tdate - b.pdate || b.tdate
      }
      accountRecords.journalentries
        .sort(byPostingDate)
        .forEach((row) => {
          const {pamount,pdate,tdate,pcomment,tindex}= row
          const amt= pamount.aquantity.floatingPoint*100
          const trans= transactions[tindex]
          trans.allpostings= postings
          accttable.createRow(function* () {
            yield createCell("td", pdate || tdate)
            yield createCell("td", dollarsAndCents(pamount), { class: "rj" })
            yield createCell("td", pcomment);
            const transTD = createCell("td");
            transTD.appendChild(
              createElement(
                "a",
                { class: "stacked", href: "#" },
                trans.tdescription,
                { click: transactionPopup.bind(trans) }
              )
            );
            yield transTD;
          });
      });
    } else {  // !hledger
      const currentTransSort= function (a,b) {
        return a.yyyymmdd - b.yyyymmdd
      }
      accountRecords.journalentries.map(j =>{
          const je = postings[j];

          const transactionList= [];
          function descendTransactions(tlist, indices) {
            const firstElement = indices.shift();
            if (firstElement === undefined) return;
            const currentTrans = tlist[firstElement];
            if (!currentTrans.yyyymmdd) currentTrans.yyyymmdd = currentTrans.date;
            transactionList.push(currentTrans);
            if (currentTrans.transactions)
              descendTransactions(currentTrans.transactions, indices);
          }
          descendTransactions(transactions, je[4].slice());

          return {
            je: je,
            yyyymmdd: transactionList[transactionList.length - 1]?.yyyymmdd,
            transactionList: transactionList
          }
        }
      )
      .sort(currentTransSort)
      .forEach((row) => {
        const {je,yyyymmdd,transactionList}= row
        accttable.createRow(function* () {
          yield createCell("td", yyyymmddToDisplay(yyyymmdd) || '')
          for (const n of [1, 2]) {
            yield createCell("td", dollarsAndCents(je[n]), { class: "rj" });
          }
          yield createCell("td", je[3] || "");
          const transTD = createCell("td");
          for (const trans of transactionList.reverse()) {
            transTD.appendChild(
              createElement(
                "a",
                { class: "stacked", href: "#" },
                trans.description,
                { click: transactionPopup.bind(trans) }
              )
            );
          }
          yield transTD;
        });
      });
    }

    accttable.appendTo(accountPanel);

    if (hledger) {
      accountPanel.appendChild(createElement("div", null, `Total: ${dollarsAndCents(accountRecords.sum)}`));
    }
    else {
      accountPanel.appendChild(createElement("h3", null, "Summary"));

      const jtable = new SimpleTable({
        headings: [
          { field: "debit", text: "Debit" },
          { field: "credit", text: "Credit" },
          { field: "credit", text: "Difference" },
        ],
      });

      jtable.createRow(function* () {
        const sum = accountRecords.sum;
        for (const n of [1, 2]) {
          yield createCell("td", dollarsAndCents(sum[n]), { class: "rj" });
        }
        yield createCell("td", dollarsAndCents(sum[1] - sum[2]), {
          class: "rj",
        });
      });

      jtable.appendTo(accountPanel);
    }
  }

  const treeul = document.querySelector("#tree");
  const tree = datafile.tree;

  document.querySelector("#pagetitle").innerHTML = datafile.description;

  function addTreeSection(macroAccount, ul) {
    macroAccount.forEach((sub) => {
      const sum = sub.sum;
      const diff = hledger? sum : sum[1] - sum[2];
      const sumspecs = ["span", { class: "sum" }, "$" + dollarsAndCents(diff)];
      if (Object.hasOwn(sub, "nodes")) {
        const chkid = `ck${sub.id}`;
        const li = createElement("li", {
          class: "section",
        });
        ul.appendChild(li);
        const checkbox = createElement("input", {
          type: "checkbox",
          id: chkid,
        });
        checkbox.addEventListener("click", clearAccountPanel);
        li.appendChild(checkbox);
        li.appendChild(
          createElement(
            "label",
            {
              for: chkid,
            },
            sub.text
          )
        );
        li.appendChild(createElement(...sumspecs));
        const subul = createElement("ul", {
          id: sub.id,
        });
        li.appendChild(subul);
        addTreeSection(sub.nodes, subul);
      } else {
        const attrs = {};
        if (Object.hasOwn(sub, "id")) attrs["id"] = sub.id;
        const li = createElement("li", attrs, [
          ["span", null, sub.text],
          sumspecs,
        ]);
        li.addEventListener("click", onLeafClick.bind(sub));
        ul.appendChild(li);
      }
    });
  }
  addTreeSection(tree, treeul);
}

function loadFile() {
  const [file] = document.querySelector("input[type=file]").files;
  const content = document.querySelector("#content");
  const reader = new FileReader();

  reader.addEventListener(
    "load",
    () => {
      // this will then display a text file
      gui(JSON.parse(reader.result));
    },
    false
  );

  if (file) {
    reader.readAsText(file);
  }
}

const filepicker = document.querySelector("#filepicker");
filepicker.addEventListener("change", loadFile);
