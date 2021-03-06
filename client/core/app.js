define([
    'hr/hr',
    'utils/url',
    'utils/dialogs',
    'utils/alerts',
    'utils/loading',
    'core/box',
    'core/session',
    'core/addons',
    'core/box',
    'core/files',
    'core/commands/toolbar',
    'core/commands/menu',
    'core/tabs',
    'core/panels',
    'core/operations',
    'core/localfs',
    'core/themes'
], function (hr, url, dialogs, alerts, loading,
box, session, addons, box, files, commands, menu, tabs, panels, operations, localfs, themes) {

    // Define base application
    var Application = hr.Application.extend({
        name: "Codebox",
        template: "main.html",
        metas: {
            "description": "Cloud IDE on a box."
        },
        links: {
            "icon": hr.Urls.static("images/icons/32.png"),
            "apple-touch-icon": hr.Urls.static("images/icons/ios.png")
        },
        events: {
            "click .cb-login .login-box #login-submit": "actionLoginBox"
        },

        // Constructor
        initialize: function() {
            Application.__super__.initialize.apply(this, arguments);
            this._autologin = true;

            // Tabs
            tabs.on("tabs:default tabs:opennew", function() {
                files.openNew();
            }, this);

            // Panels
            panels.on("open", function() {
                this.toggleMode("body-fullpage", false);
            }, this);
            panels.on("close", function() {
                this.toggleMode("body-fullpage", true);
            }, this);

            // Offline: state/update
            hr.Offline.on("state", function(state) {
                if (!state) {
                    alerts.show("Caution: Connection lost, Workspace is now in Offline mode", 5000);
                } else {
                    alerts.show("Connection detected. Switching to Codebox online", 5000);
                    location.reload();
                }
            });
            hr.Offline.on("update", function() {
                location.reload();
            });

            // Title changed
            box.on("change:name", function() {
                this.title(box.get("name"));
            }, this);

            return this;
        },

        // Template rendering context
        templateContext: function() {
            return {
                'email': hr.Cookies.get("email"),
                'token': hr.Cookies.get("token"),
            };
        },

        // Render the application
        render: function() {
            var email = hr.Cookies.get("email");
            var password = hr.Cookies.get("token");

            if (!box.isAuth() && email && password && this._autologin) {
                this.doLogin(email, password, true);
                return;
            }
            return Application.__super__.render.apply(this, arguments);
        },

        // Finish rendering
        finish: function() {
            var that = this;

            if (box.isAuth()) {
                // Add menu
                menu.$el.appendTo(this.$(".cb-menubar"));
                menu.render();
                
                // Add commands
                commands.$el.appendTo(this.$(".cb-commands"));
                commands.render();

                // Add tabs
                tabs.$el.appendTo(this.$(".cb-body"));
                tabs.render();

                // Add panels
                panels.$el.appendTo(this.$(".cb-panels"));
                panels.render();

                // Add operations
                operations.$el.appendTo(this.$(".lateral-operations"));
                operations.render();

                // Load addons
                loading.show(addons.loadAll().then(themes.init, function(err) {
                    return dialogs.alert("Fatal error", "Fatal error when loading addons, try to reload the all application and reset the cache. Error message: "+(err.message || err));
                }).fin(function() {
                    
                    // Load new addons
                    addons.on("add", function(addon) {
                        addon.load();
                    });

                    // Open root files
                    files.openNew();

                    // Check update
                    hr.Offline.checkUpdate();
                }), "Loading add-ons");
            }
            return Application.__super__.finish.apply(this, arguments);
        },

        // Login to box
        actionLoginBox: function(e) {
            var that = this;
            if (e) {
                e.preventDefault();
            }

            var email = this.$(".login-box #login-email").val();
            var password = this.$(".login-box #login-token").val();
            var tosave = this.$(".login-box #login-save").is(":checked");

            this.doLogin(email, password, tosave);
        },

        // Do login
        doLogin: function(email, password, tosave) {
            var that = this;

            // If public: generate a random password
            if (box.get("public")) {
                password = Math.random().toString(36).substring(8);
            }

            // Clear errors
            this.$(".login-box .form-group").removeClass("has-error");

            // No email
            if (!email) {
                this.$(".login-box #login-email").parent(".form-group").addClass("has-error");
                return Q.reject(new Error("No email"));
            }

            // No password
            if (!password) {
                this.$(".login-box #login-token").parent(".form-group").addClass("has-error");
                return Q.reject(new Error("No password"));
            }

            return session.start(email, password).then(function() {
                if (tosave) {
                    hr.Cookies.set("email", email);
                    hr.Cookies.set("token", password);
                } else {
                    hr.Cookies.set("email", "");
                    hr.Cookies.set("token", "");
                }
                that.render();
            }).fail(function(err) {
                that._autologin = false;
                dialogs.alert("Error at login", err.message).fin(function() {
                    that.render();
                });
            });
        },

        // Toggle mode
        toggleMode: function(mode, st) {
            $("#codebox").toggleClass("mode-"+mode, st);
            st = this.hasMode(mode);
            $(".cb-active-mode-"+mode).toggleClass("active", st);
            $(".cb-inactive-mode-"+mode).toggleClass("active", !st);
        },
        hasMode: function(mode, st) {
            return $("#codebox").hasClass("mode-"+mode);
        }
    });

    var app = new Application();
    return app;
});
