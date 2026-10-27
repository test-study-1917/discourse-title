import Component from "@glimmer/component";
import { registerDestructor } from "@ember/destroyable";
import { service } from "@ember/service";
import { apiInitializer } from "discourse/lib/api";
import TrackedMediaQuery from "discourse/lib/tracked-media-query";
import ReplyDirectory from "../components/reply-directory.gjs";
import { replyDirectoryEnabled } from "../lib/reply-directory-settings.js";

class SidebarDirectory extends Component {
  @service siteSettings;

  get visible() {
    return (
      this.args.outletArgs.renderTimeline &&
      !this.args.outletArgs.topicProgressExpanded &&
      replyDirectoryEnabled(this.args.outletArgs.topic, this.siteSettings)
    );
  }

  <template>
    {{#if this.visible}}
      <ReplyDirectory @topic={{@outletArgs.topic}} />
    {{/if}}
  </template>
}

class InlineDirectory extends Component {
  @service site;
  @service siteSettings;

  widthQuery = new TrackedMediaQuery("(min-width: 925px)");

  constructor() {
    super(...arguments);
    registerDestructor(this, () => this.widthQuery.teardown());
  }

  get visible() {
    return (
      (this.site.mobileView || !this.widthQuery.matches) &&
      replyDirectoryEnabled(this.args.outletArgs.model, this.siteSettings)
    );
  }

  <template>
    {{#if this.visible}}
      <ReplyDirectory @inline={{true}} @topic={{@outletArgs.model}} />
    {{/if}}
  </template>
}

export default apiInitializer((api) => {
  api.renderInOutlet("topic-navigation", SidebarDirectory);
  api.renderInOutlet("topic-above-posts", InlineDirectory);
});
