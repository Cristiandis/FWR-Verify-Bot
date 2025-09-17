const fs = require("fs");
const path = require("path");

// TODO: create a definition file
class ModuleManager {
  constructor(client) {
    this.client = client;
    this.modules = new Map();
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      return JSON.parse(fs.readFileSync("./config.json", "utf8"));
    } catch (error) {
      console.error("Error loading config:", error);
      return {};
    }
  }

  addModule(modulePath) {
    const moduleClass = require(modulePath);
    try {
      const module = new moduleClass(this.client, this.config);
      this.modules.set(module.name, module);
    } catch (error) {
      console.error(
        "error while trying to init module: %s\n%s",
        JSON.stringify(module?.name),
        error
      );
    }
  }

  // remove a module
  removeModule(moduleName) {
    const module = this.modules.get(moduleName);
    if (module) {
      try {
        module?.disable();
      } catch (error) {
        console.error(
          "error while trying to disable module: %s\n%s",
          JSON.stringify(module?.name),
          error
        );
      }
      this.modules.delete(moduleName);
    } else {
      console.warn(`Module ${moduleName} not found.`);
    }
  }

  loadModulesFromDirectory(directory) {
    const files = fs.readdirSync(directory);
    files.forEach((file) => {
      if (file.endsWith(".js") && !file.includes("stickyMessage")) {
        // ignore stickyMessage.js
        const modulePath = "./" + path.join(directory, file);
        this.addModule(modulePath);
      }
    });
  }

  startupModules() {
    for (const [name, module] of this.modules) {
      try {
        module?.enabled();
      } catch (error) {
        console.error(
          "error while trying to enable module: %s\n%s",
          JSON.stringify(name),
          error
        );
      }
    }
  }
}

module.exports = ModuleManager;
