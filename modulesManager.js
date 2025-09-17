const fs = require('fs');
const path = require('path');

class ModuleManager {
  constructor(client) {
    this.client = client;
    this.modules = new Map();
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      return JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    } catch (error) {
      console.error('Error loading config:', error);
      return {};
    }
  }


  addModule(modulePath) {
    const moduleInstance = require(modulePath).default(this.client, this.config);
    this.modules.set(moduleInstance.name, moduleInstance);
    }

  // remove a module
  removeModule(moduleName) {
    const moduleInstance = this.modules.get(moduleName);
    if (moduleInstance) {
      moduleInstance.disable();
      this.modules.delete(moduleName);
    } else {
      console.warn(`Module ${moduleName} not found.`);
    }
  }


  loadModulesFromDirectory(directory) {
    const files = fs.readdirSync(directory);
    files.forEach(file => {
      if (file.endsWith('.js')) {
        const modulePath = path.join(directory, file);
        this.addModule(modulePath);
      }
    });
  }
}

module.exports = ModuleManager;
