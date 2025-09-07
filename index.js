const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js")
const fs = require("fs")
const StickyMessageManager = require("./modules/stickyMessage")
require("dotenv").config()

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
})

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"))
const stickyManager = new StickyMessageManager(client)

function saveConfig() {
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 2))
}

function hasAdminPermission(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true
  if (config.adminRoleIds && config.adminRoleIds.length > 0) {
    return config.adminRoleIds.some((roleId) => member.roles.cache.has(roleId))
  }
  return false
}

function createConfigPanel(guild) {
  let adminRoles = "Not Set"
  if (config.adminRoleIds && config.adminRoleIds.length > 0) {
    const roleNames = config.adminRoleIds.map((roleId) => guild.roles.cache.get(roleId)?.name).filter((name) => name)
    adminRoles = roleNames.length > 0 ? roleNames.join(", ") : "Not Set"
  }

  const unverifiedRole = config.unverifiedRoleId
    ? guild.roles.cache.get(config.unverifiedRoleId)?.name || "Not Set"
    : "Not Set"

  const verifiedRole = config.verifiedRoleId
    ? guild.roles.cache.get(config.verifiedRoleId)?.name || "Not Set"
    : "Not Set"

  const embed = new EmbedBuilder()
    .setTitle("🔧 Bot Configuration Panel")
    .setDescription("Configure all bot settings from this unified panel")
    .addFields(
      { name: "👑 Admin Roles", value: adminRoles, inline: true },
      { name: "🔐 Verification Password", value: config.verificationPassword ? "Set" : "Not Set", inline: true },
      { name: "🎭 Unverified Role", value: unverifiedRole, inline: true },
      { name: "✅ Verified Role", value: verifiedRole, inline: true },
      { name: "📝 Embed Title", value: config.embedTitle || "Not Set", inline: true },
      {
        name: "📄 Embed Description",
        value: config.embedDescription
          ? config.embedDescription.length > 50
            ? config.embedDescription.substring(0, 50) + "..."
            : config.embedDescription
          : "Not Set",
        inline: true,
      },
      { name: "🎨 Embed Color", value: config.embedColor || "#0099ff", inline: true },
      { name: "🔘 Button Text", value: config.buttonText || "Not Set", inline: true },
      { name: "📌 Sticky Message", value: config.stickyMessage?.enabled ? "Enabled" : "Disabled", inline: true },
    )
    .setColor(config.embedColor || "#0099ff")

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("config_select")
    .setPlaceholder("Select a setting to configure")
    .addOptions([
      { label: "Admin Roles", description: "Manage admin roles", value: "adminrole", emoji: "👑" },
      { label: "Verification Password", description: "Set the verification password", value: "password", emoji: "🔐" },
      {
        label: "Unverified Role",
        description: "Set the role to be removed after verification",
        value: "unverified_role",
        emoji: "🎭",
      },
      {
        label: "Verified Role",
        description: "Set the role to be added after verification",
        value: "verified_role",
        emoji: "✅",
      },
      {
        label: "Embed Settings",
        description: "Configure embed title, description, and color",
        value: "embed",
        emoji: "📝",
      },
      { label: "Button Text", description: "Set the verification button text", value: "button", emoji: "🔘" },
      { label: "Sticky Message", description: "Toggle sticky message mode", value: "sticky", emoji: "📌" },
    ])

  const row = new ActionRowBuilder().addComponents(selectMenu)
  return { embeds: [embed], components: [row] }
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`)

  const commands = [
    new SlashCommandBuilder().setName("config").setDescription("Open the unified configuration panel"),
    new SlashCommandBuilder().setName("setup").setDescription("Setup the verification system in this channel"),
  ]

  try {
    await client.application.commands.set(commands)
    console.log("Slash commands registered successfully")
  } catch (error) {
    console.error("Error registering commands:", error)
  }
})

client.on("messageCreate", async (message) => {
  await stickyManager.handleMessage(message)
})

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction

    if (commandName === "config") {
      if (!hasAdminPermission(interaction.member)) {
        return interaction.reply({
          content: "You do not have permission to use this command.",
          flags: [MessageFlags.Ephemeral],
        })
      }

      const configPanel = createConfigPanel(interaction.guild)
      await interaction.reply({ ...configPanel, flags: [MessageFlags.Ephemeral] })
    }

    if (commandName === "setup") {
      if (!hasAdminPermission(interaction.member)) {
        return interaction.reply({
          content: "You do not have permission to use this command.",
          flags: [MessageFlags.Ephemeral],
        })
      }

      if (config.stickyMessage?.enabled) {
        await stickyManager.setupStickyMessage(interaction.channel)
        await interaction.reply({
          content: "Verification system setup with sticky message enabled!",
          flags: [MessageFlags.Ephemeral],
        })
      } else {
        const embed = new EmbedBuilder()
          .setTitle(config.embedTitle)
          .setDescription(config.embedDescription)
          .setColor(config.embedColor)

        const button = new ButtonBuilder()
          .setCustomId("verify_button")
          .setLabel(config.buttonText)
          .setStyle(ButtonStyle.Primary)

        const row = new ActionRowBuilder().addComponents(button)

        await interaction.reply({ embeds: [embed], components: [row] })
      }
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "config_select") {
      const selectedValue = interaction.values[0]

      if (selectedValue === "sticky") {
        const currentState = config.stickyMessage?.enabled || false
        const newState = !currentState

        if (newState) {
          if (!config.stickyMessage) {
            config.stickyMessage = { enabled: false, channelId: null, messageId: null }
          }
          config.stickyMessage.enabled = true
          saveConfig()
          await interaction.reply({
            content: "Sticky message enabled. Use /setup to activate it in a channel.",
            flags: [MessageFlags.Ephemeral],
          })
        } else {
          if (!config.stickyMessage) {
            config.stickyMessage = { enabled: false, channelId: null, messageId: null }
          }
          config.stickyMessage.enabled = false
          config.stickyMessage.channelId = null
          config.stickyMessage.messageId = null
          saveConfig()
          stickyManager.disableStickyMessage()
          await interaction.reply({
            content: "Sticky message disabled.",
            flags: [MessageFlags.Ephemeral],
          })
        }
        return
      }

      const modal = new ModalBuilder().setCustomId(`config_modal_${selectedValue}`).setTitle("Configuration")

      const inputs = []

      switch (selectedValue) {
        case "adminrole":
          inputs.push(
            new TextInputBuilder()
              .setCustomId("role_action")
              .setLabel("Action (add/remove/clear)")
              .setPlaceholder("Type 'add', 'remove', or 'clear'")
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
            new TextInputBuilder()
              .setCustomId("role_id")
              .setLabel("Role ID (for add/remove)")
              .setPlaceholder("Enter role ID or mention (leave empty for clear)")
              .setStyle(TextInputStyle.Short)
              .setRequired(false),
          )
          break

        case "password":
          inputs.push(
            new TextInputBuilder()
              .setCustomId("password")
              .setLabel("Verification Password")
              .setPlaceholder("Enter the new verification password")
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          )
          break

        case "unverified_role":
          inputs.push(
            new TextInputBuilder()
              .setCustomId("verify_role_id")
              .setLabel("Unverified Role ID")
              .setPlaceholder("Enter the role ID or mention the role")
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          )
          break

        case "verified_role":
          inputs.push(
            new TextInputBuilder()
              .setCustomId("verified_role_id")
              .setLabel("Verified Role ID")
              .setPlaceholder("Enter the role ID or mention the role")
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          )
          break

        case "embed":
          inputs.push(
            new TextInputBuilder()
              .setCustomId("embed_title")
              .setLabel("Embed Title")
              .setPlaceholder("Enter the embed title")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(config.embedTitle || ""),
            new TextInputBuilder()
              .setCustomId("embed_description")
              .setLabel("Embed Description")
              .setPlaceholder("Enter the embed description")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setValue(config.embedDescription || ""),
            new TextInputBuilder()
              .setCustomId("embed_color")
              .setLabel("Embed Color (Hex)")
              .setPlaceholder("#0099ff")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setValue(config.embedColor || "#0099ff"),
          )
          break

        case "button":
          inputs.push(
            new TextInputBuilder()
              .setCustomId("button_text")
              .setLabel("Button Text")
              .setPlaceholder("Enter the button text")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(config.buttonText || ""),
          )
          break
      }

      inputs.forEach((input, index) => {
        const row = new ActionRowBuilder().addComponents(input)
        modal.addComponents(row)
      })

      await interaction.showModal(modal)
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === "verify_button") {
      const modal = new ModalBuilder().setCustomId("verification_modal").setTitle("Server Verification")

      const passwordInput = new TextInputBuilder()
        .setCustomId("password_input")
        .setLabel("Password")
        .setPlaceholder("Please read the rules before entering the password")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)

      const actionRow = new ActionRowBuilder().addComponents(passwordInput)
      modal.addComponents(actionRow)

      await interaction.showModal(modal)
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "verification_modal") {
      const password = interaction.fields.getTextInputValue("password_input")

      if (password === config.verificationPassword) {
        if (!config.unverifiedRoleId) {
          return interaction.reply({
            content: "Verification role not configured. Please contact an administrator.",
            flags: [MessageFlags.Ephemeral],
          })
        }

        try {
          const unverifiedRole = interaction.guild.roles.cache.get(config.unverifiedRoleId)
          if (!unverifiedRole) {
            return interaction.reply({
              content: "Unverified role not found. Please contact an administrator.",
              flags: [MessageFlags.Ephemeral],
            })
          }

          await interaction.member.roles.remove(unverifiedRole)

          if (config.verifiedRoleId) {
            const verifiedRole = interaction.guild.roles.cache.get(config.verifiedRoleId)
            if (verifiedRole) {
              await interaction.member.roles.add(verifiedRole)
            }
          }

          await interaction.reply({
            content: "Verification successful! You now have access to the server.",
            flags: [MessageFlags.Ephemeral],
          })
        } catch (error) {
          console.error("Error managing roles:", error)
          await interaction.reply({
            content: "An error occurred while verifying. Please contact an administrator.",
            flags: [MessageFlags.Ephemeral],
          })
        }
      } else {
        await interaction.reply({ content: "Incorrect password. Please try again.", flags: [MessageFlags.Ephemeral] })
      }
    }

    if (interaction.customId.startsWith("config_modal_")) {
      const configType = interaction.customId.replace("config_modal_", "")

      try {
        switch (configType) {
          case "adminrole":
            const action = interaction.fields.getTextInputValue("role_action").toLowerCase()
            const roleInput = interaction.fields.getTextInputValue("role_id")

            if (!config.adminRoleIds) {
              config.adminRoleIds = []
            }

            if (action === "clear") {
              config.adminRoleIds = []
              saveConfig()
              await interaction.reply({ content: "All admin roles cleared.", flags: [MessageFlags.Ephemeral] })
            } else if (action === "add") {
              if (!roleInput) {
                return interaction.reply({
                  content: "Role ID is required for add action.",
                  flags: [MessageFlags.Ephemeral],
                })
              }
              const roleId = roleInput.replace(/[<@&>]/g, "")
              const role = interaction.guild.roles.cache.get(roleId)
              if (!role) {
                return interaction.reply({
                  content: "Invalid role ID or role not found.",
                  flags: [MessageFlags.Ephemeral],
                })
              }
              if (config.adminRoleIds.includes(roleId)) {
                return interaction.reply({ content: "Role is already an admin role.", flags: [MessageFlags.Ephemeral] })
              }
              config.adminRoleIds.push(roleId)
              saveConfig()
              await interaction.reply({ content: `Added ${role.name} as admin role.`, flags: [MessageFlags.Ephemeral] })
            } else if (action === "remove") {
              if (!roleInput) {
                return interaction.reply({
                  content: "Role ID is required for remove action.",
                  flags: [MessageFlags.Ephemeral],
                })
              }
              const roleId = roleInput.replace(/[<@&>]/g, "")
              const roleIndex = config.adminRoleIds.indexOf(roleId)
              if (roleIndex === -1) {
                return interaction.reply({ content: "Role is not an admin role.", flags: [MessageFlags.Ephemeral] })
              }
              const role = interaction.guild.roles.cache.get(roleId)
              config.adminRoleIds.splice(roleIndex, 1)
              saveConfig()
              await interaction.reply({
                content: `Removed ${role?.name || "role"} from admin roles.`,
                flags: [MessageFlags.Ephemeral],
              })
            } else {
              return interaction.reply({
                content: "Invalid action. Use 'add', 'remove', or 'clear'.",
                flags: [MessageFlags.Ephemeral],
              })
            }
            break

          case "password":
            const password = interaction.fields.getTextInputValue("password")
            config.verificationPassword = password
            saveConfig()
            await interaction.reply({
              content: "Verification password updated successfully.",
              flags: [MessageFlags.Ephemeral],
            })
            break

          case "unverified_role":
            const verifyRoleInput = interaction.fields.getTextInputValue("verify_role_id")
            const verifyRoleId = verifyRoleInput.replace(/[<@&>]/g, "")
            const verifyRole = interaction.guild.roles.cache.get(verifyRoleId)
            if (!verifyRole) {
              return interaction.reply({
                content: "Invalid role ID or role not found.",
                flags: [MessageFlags.Ephemeral],
              })
            }
            config.unverifiedRoleId = verifyRoleId
            saveConfig()
            await interaction.reply({
              content: `Unverified role set to ${verifyRole.name}`,
              flags: [MessageFlags.Ephemeral],
            })
            break

          case "verified_role":
            const verifiedRoleInput = interaction.fields.getTextInputValue("verified_role_id")
            const verifiedRoleId = verifiedRoleInput.replace(/[<@&>]/g, "")
            const verifiedRole = interaction.guild.roles.cache.get(verifiedRoleId)
            if (!verifiedRole) {
              return interaction.reply({
                content: "Invalid role ID or role not found.",
                flags: [MessageFlags.Ephemeral],
              })
            }
            config.verifiedRoleId = verifiedRoleId
            saveConfig()
            await interaction.reply({
              content: `Verified role set to ${verifiedRole.name}`,
              flags: [MessageFlags.Ephemeral],
            })
            break

          case "embed":
            const title = interaction.fields.getTextInputValue("embed_title")
            const description = interaction.fields.getTextInputValue("embed_description")
            const color = interaction.fields.getTextInputValue("embed_color") || "#0099ff"

            config.embedTitle = title
            config.embedDescription = description
            config.embedColor = color
            saveConfig()
            await interaction.reply({
              content: "Embed configuration updated successfully.",
              flags: [MessageFlags.Ephemeral],
            })
            break

          case "button":
            const buttonText = interaction.fields.getTextInputValue("button_text")
            config.buttonText = buttonText
            saveConfig()
            await interaction.reply({ content: "Button text updated successfully.", flags: [MessageFlags.Ephemeral] })
            break
        }
      } catch (error) {
        console.error("Error updating config:", error)
        await interaction.reply({
          content: "An error occurred while updating the configuration.",
          flags: [MessageFlags.Ephemeral],
        })
      }
    }
  }
})

client.login(process.env.DISCORD_TOKEN)
