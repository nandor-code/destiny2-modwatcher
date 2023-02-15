#!/usr/bin/env python3

from aws_cdk import core

from mod_watcher.mod_watcher_stack import ModWatcherStack


app = core.App()
ModWatcherStack(app, "mod-watcher")

app.synth()
