const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")
const fs = require("fs")

class StickyMessageManager {
  constructor(client) {
    this.client = client
    this.config = JSON.parse(fs.readFileSync("./config.json", "utf8"))
  }

  saveConfig() {
    fs.writeFileSync("./config.json", JSON.stringify(this.config, null, 2))
  }

  async handleMessage(message) {
    if (!this.config.stickyMessage.enabled) return
    if (!this.config.stickyMessage.channelId || !this.config.stickyMessage.messageId) return
    if (message.author.bot) return
    if (message.channel.id !== this.config.stickyMessage.channelId) return

    try {
      const channel = this.client.channels.cache.get(this.config.stickyMessage.channelId)
      if (!channel) return

      const messages = await channel.messages.fetch({ limit: 2 })
      const lastMessage = messages.first()

      if (lastMessage && lastMessage.id !== this.config.stickyMessage.messageId) {
        try {
          const stickyMessage = await channel.messages.fetch(this.config.stickyMessage.messageId)
          if (stickyMessage) {
            await stickyMessage.delete()
          }
        } catch (error) {
          console.log("Sticky message not found, creating new one")
        }

        const newStickyMessage = await this.createVerificationMessage(channel)
        this.config.stickyMessage.messageId = newStickyMessage.id
        this.saveConfig()
      }
    } catch (error) {
      console.error("Error handling sticky message:", error)
    }
  }

  async createVerificationMessage(channel) {
    const embed = new EmbedBuilder()
      .setTitle(this.config.embedTitle)
      .setDescription(this.config.embedDescription)
      .setColor(this.config.embedColor)

    const button = new ButtonBuilder()
      .setCustomId("verify_button")
      .setLabel(this.config.buttonText)
      .setStyle(ButtonStyle.Primary)

    const row = new ActionRowBuilder().addComponents(button)

    return await channel.send({ embeds: [embed], components: [row] })
  }

  async setupStickyMessage(channel) {
    const message = await this.createVerificationMessage(channel)

    this.config.stickyMessage = {
      enabled: true,
      channelId: channel.id,
      messageId: message.id,
    }
    this.saveConfig()

    return message
  }

  disableStickyMessage() {
    this.config.stickyMessage = {
      enabled: false,
      channelId: null,
      messageId: null,
    }
    this.saveConfig()
  }

  toggleStickyMessage() {
    this.config.stickyMessage.enabled = !this.config.stickyMessage.enabled
    this.saveConfig()
    return this.config.stickyMessage.enabled
  }
}

module.exports = StickyMessageManager
