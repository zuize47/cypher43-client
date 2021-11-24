const vscode = require('vscode');
const axios = require('axios');
var jp = require('jsonpath');

const get_host_regex = /neo4j:(http(s)?:\/\/\w*\:\d{4,5})/
const remove_comment_regex = /(s:\/\*.*?\*\/)|\/\/.*/g
const remmove_new_line = /(\r\n|\n|\r)/gm
const outputChannel = vscode.window.createOutputChannel(`Cypher Output`);
const epic_regx = /(\d{10}|\d{13})/

function post_cypher(cypher, host) {
	const cypher_fixed = cypher.replace(remove_comment_regex, " ").replace(remmove_new_line, " ");
	return axios.post(`${host}/db/neo4j/tx/commit`, {
		statements: [
			{
				statement: cypher_fixed,
				parameters: {}
			}
		]
	});

}
let running = false;

function epoctime () {
	vscode.env.clipboard.readText().then((text)=>{
		const clipboard_content = text; 
		const matches = clipboard_content.match(epic_regx)
		let le = 1000
		if (matches != null) {
			const epic_int = parseInt(clipboard_content)
			if (clipboard_content.length == 13) {
				le = 1
			}
			const date_str = new Date(epic_int * le).toISOString();
			vscode.window.showInformationMessage(date_str);
			vscode.env.clipboard.writeText(date_str);
		}
	});
}

function convertToCSV(arr) {
	const array = [Object.keys(arr[0])].concat(arr)
  
	return array.map(it => {
	  return Object.values(it).toString()
	}).join('\n')
  }

function neo4jOutput2Csv () {
	vscode.env.clipboard.readText().then((text)=>{
		const clipboard_content = text; 
		try {
			const jobject = JSON.parse(clipboard_content)
			const columns = jp.query(jobject, '$..columns')[0]
			const rows = jp.query(jobject, '$..row')
			let csv = columns.join(',') + '\n'
			rows.forEach(row => {
				csv += row.join(',') + '\n'
			})
			vscode.env.clipboard.writeText(csv);
		} catch (error) {
			vscode.window.showErrorMessage(JSON.stringify(error));
		}
	});
}

function activate (context) {
	const disposableEpoc = vscode.commands.registerCommand('cypher43-client.convertEpoc', epoctime);
	const disposableCsv = vscode.commands.registerCommand('cypher43-client.neo4j2Csv', neo4jOutput2Csv);
	const disposable = vscode.commands.registerCommand('cypher43-client.runCypher', function () {

		if (running) {
			vscode.window.showWarningMessage("Job is running");
			return
		}
		running = true
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const document = editor.document;
			const full_text = document.getText()
			// default run all
			let script = full_text
			const matches = full_text.match(get_host_regex)
			if (matches == null || matches.length < 2) {
				vscode.window.showErrorMessage('Add neo4j host at first line:`//neo4j:http://hostname:port`');
				return
			}
			const host = matches[1]
			// run with selection
			var selection = editor.selection;	
			const word = document.getText(selection);
			if (word.length > 0) {
				script = word				
			}

			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Loading data!",
			}, (progress) => {
				let count = 1;
				const interval = setInterval(function () {
					progress.report({
						increment: count < 99 ? count++ : count,
						message: `Loading data ${count}%`
					});
				}, 700);
				return post_cypher(script, host)
					.then((response) => {
						const data = response.data
						if (data.errors.length > 0) {
							outputChannel.clear();
							outputChannel.appendLine(JSON.stringify(data.errors, null, 2));
							outputChannel.show();
						}else {
							outputChannel.clear();
							outputChannel.appendLine(JSON.stringify(data.results, null, 2));
							outputChannel.show();
						}
						
					})
					.catch(error => {
						vscode.window.showErrorMessage(JSON.stringify(error));
					})
					.finally(() => {
						running = false
						progress.report({ increment: 100 });
						clearInterval(interval)
					})
			});


		}
	});
	
	context.subscriptions.push(disposableEpoc);
	context.subscriptions.push(disposableCsv);
	context.subscriptions.push(disposable);

}

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
