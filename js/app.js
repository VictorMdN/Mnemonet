let vocabularyData = [];
let fromColumns = [];
let toColumn = "";
let errors = 0;
let reposition = false;
let challengeData = null;
let challengeOrder = [];
let openFilter = null;
let mode = null;
let score = 0;
let previous = null;
let enterDummy = "loadButton";
let answerLibrary = [];
let skipElementLits = [];

document.addEventListener("DOMContentLoaded", () => {
	
	let spreadsheetsSelect = document.getElementById("spreadsheets");
	
	fetch("./spreadsheets/index.json")
		.then(res => res.json())
		.then(files => {
			files.forEach(sheetName => {
				const option = document.createElement("option");
				option.textContent = sheetName.split(".")[0];
				option.value = sheetName;
				spreadsheetsSelect.appendChild(option);
			});
		});
	
	document.getElementById('uploadButton').addEventListener('click', function() {
		document.getElementById('fileInput').click();
	});

	document.getElementById('loadButton').addEventListener('click', function() {
		const spreadsheetsSelect = document.getElementById("spreadsheets");
		fetch("./spreadsheets/" + encodeURIComponent(spreadsheetsSelect.value))
			.then(res => {
				if (!res.ok) throw new Error("Error loading file");
				return res.arrayBuffer();
			})
			.then(buffer => {
				applyFile(spreadsheetsSelect.options[spreadsheetsSelect.selectedIndex].text, buffer);
			})
			.catch(err => console.error("Error loading speadsheet:", err));
		
		enterDummy = "startButton";
	});

	document.getElementById('fileInput').addEventListener('change', function(event) {
		const file = event.target.files[0];
		
		const reader = new FileReader();
		reader.readAsBinaryString(file);
		reader.onload = function(e) {
			applyFile(file.name, e.target.result);
		};
	});

	document.addEventListener('keydown', function(event) {
		if (event.key === 'Enter') {
			if (document.activeElement.tagName !== "BUTTON")
				document.getElementById(enterDummy).click();
		}
	});

	document.addEventListener("click", e => {
		if (skipElementLits.some(el => el.contains(e.target))) return;
		if (openFilter) {
			openFilter.classList.add("hidden");
			openFilter = null;
		}
	});
	
	document.getElementById("startButton").addEventListener("click", function() {
		fromColumns = Array.from(document.querySelectorAll("#dataTable input:checked:not(.filter-menu input:checked)")).map(cb => cb.value);
		if (fromColumns.length == 0) return;
		
		setMode();
		toColumn = document.getElementById("toColumn").value;
		
		localStorage.setItem("file_" + document.getElementById("title").textContent, JSON.stringify({
			mode: mode,
			answer: toColumn,
			columns: fromColumns,
			filters: getCheckedFilters(),
		}));
		
		document.getElementById("setupContainer").classList.add("hidden");
		document.getElementById("flashcardContainer").style.display = "block";
		challengeOrder = [];
		switch (mode) {
			case "Normal":
				challengeOrder = Array.from(challengeData.keys());
				break;
			case "Random":
				challengeOrder = Array.from(challengeData.keys()).reduce((accumulator, current) => {
					accumulator.splice(Math.floor(Math.random() * (accumulator.length + 1)), 0, current);
					return accumulator;
				}, []);
				break;
			case "Endless":
				while (challengeOrder.length < 10)
					challengeOrder.push(Math.floor(Math.random() * (challengeData.length + 1)));
				break;
		}
		errors = 0;
		score = 0;
		refreshFlashcard();
		answerLibrary = challengeData.flatMap(reg => reg[toColumn].split(", ").map(reg => reg.toLowerCase().split(" (")[0]));
		
		enterDummy = "nextButton";
	});

	document.getElementById("nextButton").addEventListener("click", () => verify(document.getElementById("answer").value));

	document.getElementById("answer").addEventListener("input", (e) => {
		let answer = e.target.value.split("\n");
		if (answer.length == 1) return;
		verify(answer[0]);
	});
});



function applyFile(fileName, data) {	
	if (data) {
		let title = document.getElementById('title');
		title.textContent = fileName;
		title.classList.add("slim");
		
		previous = localStorage.getItem("file_" + fileName);
		if (previous)
			previous = JSON.parse(previous);
		
		readExcel(data);
		displayOptions(vocabularyData);
		
		document.getElementById('options').classList.remove("hidden");
		document.getElementById('startButton').classList.remove("hidden");
		/*localStorage.setItem("previousFile", JSON.stringify({
			{ file.name },
			path: 
		}));*/
	}
}

function readExcel(data) {
	const workbook = XLSX.read(data, { type: "binary" });
	const sheetName = workbook.SheetNames[0];
	const sheet = workbook.Sheets[sheetName];
	vocabularyData = XLSX.utils.sheet_to_json(sheet);
	displayTable(vocabularyData);
}

function displayOptions(data) {
	const columns = Object.keys(data[0]);
	let firstOption = true;
	
	document.getElementById("toColumn").innerHTML = columns.filter(col => !col.startsWith("Filter-")).map(col => `<option value="${col}">${col}</option>`).join("");
	
	if (previous) {
		document.getElementById("mode").value = previous.mode;
		document.getElementById("toColumn").value = previous.answer;
	}
}

function displayTable(data) {
	challengeData = data;
	const table = document.getElementById("dataTable");
	table.innerHTML = "";
	if (data.length === 0) return;
	
	const columns = Object.keys(data[0]);
	
	let firstOption = !previous;
	
	const thead = document.createElement("thead");
	const noteRow = document.createElement("tr");
	const note = document.createElement("th");
	note.innerHTML = "Card content";
	note.colSpan = columns.length;
	noteRow.appendChild(note);
	
	thead.appendChild(noteRow);
	
	const headerRow = document.createElement("tr");
	columns.forEach(col => {
		const th = document.createElement("th");
		th.classList.add("relative");
		th.classList.add("no-br");
		th.id = "Field-" + col;
		th.innerHTML = `<input type='checkbox' value='${col}' class='filter-checkbox' ${ (firstOption && !(firstOption = false)) || previous?.columns.includes(col) ? "checked" : ""} />${col}`;
		headerRow.appendChild(th);
	});
	thead.appendChild(headerRow);
	table.appendChild(thead);
	
	const tbody = document.createElement("tbody");
	tbody.id = "tableBody";
	table.appendChild(tbody);
	
	displayFilters(challengeData);
	applyFilters();
	
	document.getElementById("tableContainer").classList.remove("hidden");
}

function displayData(data){
	const tbody = document.getElementById("tableBody");
	tbody.innerHTML = "";
	
	if (data.length == 0) return;
	
	const columns = Object.keys(data[0]);
	
	data.forEach(row => {
		const tr = document.createElement("tr");
		columns.forEach(col => {
			const td = document.createElement("td");
			td.textContent = row[col] || "";
			tr.appendChild(td);
		});
		tbody.appendChild(tr);
	});
}

function displayFilters(data) {
	const columns = Object.keys(data[0]).filter(col => col.startsWith("Filter-"));
	const filters = getUniqueFilterValues(columns);
	
	columns.forEach(col => {
		let values = [...new Set(data.map(row => row[col]).filter(Boolean))];
		let th = document.getElementById("Field-" + col);
		th.innerHTML = `
			<button class='filter-btn' data-col='${col}' id='btn-${col}'>${col.slice(7)}</button>
			<div class='filter-menu container hidden' id='Menu-${col}'>
				${filters[col]
					.map(value => `
						<div>
							<input type='checkbox' class='filter-checkbox' name='${col}' value='${value}' onchange='applyFilters()' data-col='${col}' ${ previous?.filters[col.substring(7)]?.includes(value) ? "checked" : ""} />
							<span>${value}</span>
						</div>
					`).join("")}
			</div>
		`;
		skipElementLits.push(document.getElementById("btn-" + col));
		skipElementLits.push(document.getElementById(`Menu-${col}`));
		document.getElementById("btn-" + col).addEventListener("click", e => {
			const col = e.target.dataset.col;
			const menu = document.getElementById(`Menu-${col}`);
			if (openFilter) {
				openFilter.classList.add("hidden");
			}
			
			if (openFilter === menu) {
				openFilter = null;
			} else {
				menu.classList.remove("hidden");
				openFilter = menu.classList.contains("hidden") ? null : menu;
			}
		});
	});
}

function getCheckedFilters(){
	const selectedFilters = {};
	document.querySelectorAll(".filter-menu input:checked").forEach(cb => {
		let filterName = cb.name.substring(7);
		if (!selectedFilters[filterName]) selectedFilters[filterName] = [];
		selectedFilters[filterName].push(cb.value);
	});
	
	return selectedFilters;
}

function applyFilters() {
	const selectedFilters = getCheckedFilters();

	challengeData = vocabularyData.filter(row => {
		return Object.keys(selectedFilters).every(filterCol => selectedFilters[filterCol].includes(row["Filter-" + filterCol]));
	});
	displayData(challengeData);
}



function nextCard() {
	switch (mode) {
		case "Normal":
		case "Random":
			challengeOrder.shift();
			break;
		case "Endless":
			challengeOrder.shift();
			while (challengeOrder.length < 10)
				challengeOrder.push(Math.floor(Math.random() * (challengeData.length + 1)));
			break;
	}
	
	if (challengeOrder.length > 0) {
		refreshFlashcard();
	} else {
		refreshFlashcardInterface();
		(new Promise(resolve => setTimeout(resolve, 5000))).then(() => {});
		requestAnimationFrame(() => {
			setTimeout(() => {
				alert(
					"Challenge finished!\n"
					+ (errors === 0 ? "You made no mistakes!" : "You made " + errors + " mistake(s).\nBetter luck next time!")
				);
				document.getElementById("flashcardContainer").style.display = "none";
				document.getElementById("setupContainer").classList.remove("hidden");
				document.getElementById("errors").style.display = "none";
			}, 100);
		});
		
		document.getElementById("dataTable").style.display = "table";
		enterDummy = "startButton";
	}
};

function verify(answer) {
	if (answer === "") return;
	let translated = challengeData[challengeOrder[0]][toColumn] || "";
	if (translated.split(", ").some(reg => reg.toLowerCase().split(" (")[0] === answer.toLowerCase())) {
		document.getElementById("correction").classList.add("hidden");
		if (!reposition) {
			score++;
		}
		reposition = false;
		nextCard();
	} else {
		if (!reposition && answer !== " " && !answerLibrary.includes(answer.toLowerCase())) {
			document.getElementById("nextButton").classList.add("hidden");
			document.getElementById("answer").classList.add("hidden");
			document.getElementById("revision").classList.remove("hidden");
			document.getElementById("negativeButton").innerHTML = "Typo";
			document.getElementById("negativeButton").addEventListener("click", typo);
			
			document.getElementById("positiveButton").innerHTML = "Error";
			document.getElementById("positiveButton").addEventListener("click", () => trueError(translated));
			document.getElementById("correction").innerHTML = "Answer sent: " + answer;
			document.getElementById("correction").classList.remove("hidden");
			
			enterDummy = "positiveButton";
		} else {
			trueError(translated);
		}
	}
	document.getElementById("answer").value = "";
}

function revertRevisionCard() {
	document.getElementById("nextButton").classList.remove("hidden");
	document.getElementById("answer").classList.remove("hidden");
	document.getElementById("revision").classList.add("hidden");
	document.getElementById("correction").classList.add("hidden");
	enterDummy = "nextButton";
}

function typo() {
	revertRevisionCard();
	refreshFlashcard();
}

function trueError(translated) {
	revertRevisionCard();

	if (!reposition) {
		challengeOrder.splice(Math.floor(Math.random() * 6) + 2, 0, challengeOrder[0]);
		errors++;
	}
	reposition = true;
	document.getElementById("correction").classList.remove("hidden");
	document.getElementById("correction").innerHTML = "Correct answer: " + translated;
	document.getElementById("errors").style.display = "block";
	document.getElementById("errors").innerHTML = "Error counting: " + errors;

	document.getElementById("answer").focus();
}



function refreshFlashcardInterface(){
	if (!reposition) {
		let scoreElement = document.getElementById("score");
		let scoreMsg = null;
		if ("Endless" === mode) {
			scoreMsg = "Total correct answers: " + score;
		} else {
			scoreMsg = score + "/" + challengeData.length + " card(s) solved";
		}
		document.getElementById("score").innerHTML = scoreMsg;
	}
}

function refreshFlashcardData() {
	if (challengeOrder.length === 0) return;
	const entry = challengeData[challengeOrder[0]];
	document.getElementById("flashcardText").innerHTML = fromColumns.map(col => entry[col] || "").join("</br>");
}

function refreshFlashcard() {
	refreshFlashcardInterface();
	refreshFlashcardData();
	
	document.getElementById("answer").focus();
}

function getUniqueFilterValues(columns) {
	return columns.reduce((acc, col) => {
		acc[col] = [...new Set(vocabularyData.map(item => item[col]))];
		return acc;
	}, {});
}

function setMode() {
	mode = document.getElementById("mode").value;
}