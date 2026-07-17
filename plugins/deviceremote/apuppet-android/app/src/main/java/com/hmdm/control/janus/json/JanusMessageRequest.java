package com.hmdm.control.janus.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

public class JanusMessageRequest extends JanusPluginRequest {
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Body {
        private String request;
        private String id;

        // For textroom messages
        private String room;
        private String pin;
        private Boolean is_private;
        private Boolean permanent;

        public Body() {
        }

        public Body(String request, String id) {
            this.request = request;
            this.id = id;
        }

        public Body(String request, String id, String room) {
            this.request = request;
            this.id = id;
            this.room = room;
        }

        public String getRequest() {
            return request;
        }

        public void setRequest(String request) {
            this.request = request;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getRoom() {
            return room;
        }

        public void setRoom(String room) {
            this.room = room;
        }

        public String getPin() {
            return pin;
        }

        public void setPin(String pin) {
            this.pin = pin;
        }

        public Boolean getIs_private() {
            return is_private;
        }

        public void setIs_private(Boolean is_private) {
            this.is_private = is_private;
        }

        public Boolean getPermanent() {
            return permanent;
        }

        public void setPermanent(Boolean permanent) {
            this.permanent = permanent;
        }
    }

    private Body body;

    public JanusMessageRequest() {
    }

    public JanusMessageRequest(String secret, String janus, String sessionId, String handleId) {
        super(secret, janus, sessionId, handleId);
    }

    public Body getBody() {
        return body;
    }

    public void setBody(Body body) {
        this.body = body;
    }
}
