const vscode = require('vscode');
const axios = require('axios');

const get_host_regex = /neo4j:(http(s)?:\/\/\w*\:\d{4,5})/
const remove_comment_regex = /((['"])(?:(?!\2|\\).|\\.)*\2)|\/\/[^\n]*|\/\*(?:[^*]|\*(?!\/))*\*\//
const remmove_new_line = /(\r\n|\n|\r)/gm
const outputChannel = vscode.window.createOutputChannel(`Cypher Output`);


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

function activate(context) {

	const disposable = vscode.commands.registerCommand('cypher43-client.runCypher', function () {

		if (running) {
			vscode.window.showWarningMessage("Job is running");
			return
		}
		running = true
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const document = editor.document;
			let cypher_script = document.getText()
			const matches = cypher_script.match(get_host_regex)
			if (matches == null || matches.length < 2) {
				vscode.window.showErrorMessage('Add neo4j host at first line:`//neo4j:http://hostname:port`');
				return
			}
			const host = matches[1]
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
				return post_cypher(cypher_script, host)
					.then((response) => {
						outputChannel.clear();
						outputChannel.appendLine(JSON.stringify(response.data, null, 2));
						outputChannel.show();
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

	context.subscriptions.push(disposable);

}

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
