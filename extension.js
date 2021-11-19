const vscode = require('vscode');
const axios = require('axios');

const get_host_regex = /neo4j:(http(s)?:\/\/\w*\:\d{4,5})/
const remove_comment_regex = /((['"])(?:(?!\2|\\).|\\.)*\2)|\/\/[^\n]*|\/\*(?:[^*]|\*(?!\/))*\*\//
const remmove_new_line = /(\r\n|\n|\r)/gm
const outputChannel = vscode.window.createOutputChannel(`Cypher Output`);

function post_cypher(cypher, output, host) {
	const cypher_fixed = cypher.replace(remove_comment_regex, " ") .replace(remmove_new_line, " ");	
	return axios.post(`${host}/db/neo4j/tx/commit`, {
		statements: [
			{
				statement: cypher_fixed,
				parameters: {}
			}
			]
		})
	  .then(function (response) {
		outputChannel.clear()
		output.appendLine(JSON.stringify(response.data, null, 2));
		output.show()
	  })
	  .catch(function (error) {
		output.appendLine(JSON.stringify(error, null, 2));
	  });
}

function activate(context) {
	
	const disposable = vscode.commands.registerCommand('cypher43-client.runCypher', function () {
		
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
			post_cypher(cypher_script, outputChannel, host)
			
		}
	});

	context.subscriptions.push(disposable);

}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
