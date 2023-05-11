import {
	App, SuggestModal, WorkspaceLeaf,
	Modal, Plugin, Notice,
	PluginSettingTab, Setting
	} from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

interface SaveGraphsSettings {
	dataStore: string;
}

const DEFAULT_SETTINGS: SaveGraphsSettings = {
	dataStore: '.obsidian/graphs'
}

const GRAPH_DATA_PATH = '.obsidian/graph.json';

export default class SaveGraphs extends Plugin {
	settings: SaveGraphsSettings;
	dataStorePath: string;
	graphDataPath: string;

	
	async onload() {
		await this.loadSettings();
		
		const root = (this.app.vault.adapter as any).basePath;
		this.dataStorePath = path.join(root, this.settings.dataStore);
		this.graphDataPath = path.join(root, GRAPH_DATA_PATH);

		if (!fs.existsSync(this.dataStorePath)){
			fs.mkdirSync(this.dataStorePath);
		}

		this.addCommand({
			id: 'load-graph-data',
			name: 'Load a saved graph [NOT WORKING]',
			callback: () => {
				new LoadGraph(this.app, this.dataStorePath, this.graphDataPath).open();
			}
		});
		this.addCommand({
			id: 'save-graph-data',
			name: 'Save current graph',
			callback: () => {
				new SaveGraph(this.app, this.dataStorePath, this.graphDataPath).open();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SaveGraphsSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


interface Graph {
	name: string;
}

class LoadGraph extends SuggestModal<Graph> {
	dataStore: string;
	graphPath: string;
	Graphs: Graph[];

	constructor(app: App, dataStore: string, graphPath: string) {
		super(app);
		this.dataStore = dataStore;
		this.graphPath = graphPath;
		this.Graphs = [];
		var files = glob.globSync(path.join(this.dataStore, '*.json'));
		files.forEach( (file: string) => {
			this.Graphs.push({name: path.parse(file).name})
		});
	}

	getSuggestions(query: string): Graph[] {
		return this.Graphs.filter((graph) =>
			graph.name.toLowerCase().includes(query.toLowerCase())
		);
	}

	renderSuggestion(graph: Graph, el: HTMLElement) {
		el.createEl("div", { text: graph.name });
	}

	onChooseSuggestion(graph: Graph, evt: MouseEvent | KeyboardEvent) {
		var target = path.join(this.dataStore, graph.name + '.json');
		fs.copyFile(target, this.graphPath, (err) => {
			if (err) throw err;
		});

		// FIGURE OUT HOW TO FORCE RELOAD OF THE FILE AND THIS JUST WORKS
	}
}

class SaveGraph extends Modal {
	name: string;
	dataStore: string;
	graphPath: string;

	constructor(app: App, dataStore: string, graphPath: string) {
		super(app);
		this.dataStore = dataStore;
		this.graphPath = graphPath;
	}

	onSubmit(name: string) {
		var target = path.join(this.dataStore, name + '.json');
		fs.copyFile(this.graphPath, target, (err) => {
			if (err) throw err;
		});
	};

	onOpen() {
		const {contentEl} = this;

		contentEl.createEl("h3", { text: "Save graph" });

		new Setting(contentEl)
		  .setName("Name")
		  .addText((text) =>
			text.onChange((value) => {
			  this.name = value
			}));
	
		new Setting(contentEl)
		  .addButton((btn) =>
			btn
			  .setButtonText("Save")
			  .setCta()
			  .onClick(() => {
				this.close();
				this.onSubmit(this.name);
			  }));
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SaveGraphsSettingTab extends PluginSettingTab {
	plugin: SaveGraphs;

	constructor(app: App, plugin: SaveGraphs) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Save graphs plugin settings'});

		new Setting(containerEl)
			.setName('Graph storage path')
			.setDesc('Where to store the json files (relative to vault root)')
			.addText(text => text
				.setPlaceholder('.obsidian/graphs')
				.setValue(this.plugin.settings.dataStore)
				.onChange(async (value) => {
					this.plugin.settings.dataStore = value;
					await this.plugin.saveSettings(); 
				}));
	}
}
