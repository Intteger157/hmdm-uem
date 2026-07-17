package com.hmdm.control.janus.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonSetter;

import java.io.Serializable;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class JanusPluginResponse implements Serializable {
    private String janus;
    private String session_id;
    private String transaction;
    private String sender;

    public String getJanus() {
        return janus;
    }

    public void setJanus(String janus) {
        this.janus = janus;
    }

    public String getSession_id() {
        return session_id;
    }

    public String getTransaction() {
        return transaction;
    }

    public void setTransaction(String transaction) {
        this.transaction = transaction;
    }

    public String getSender() {
        return sender;
    }

    @JsonSetter("sender")
    public void setSender(Object sender) {
        this.sender = sender != null ? String.valueOf(sender) : null;
    }

    @JsonSetter("session_id")
    public void setSession_id(Object sessionId) {
        this.session_id = sessionId != null ? String.valueOf(sessionId) : null;
    }

    @Override
    public String toString() {
        return "{\"janus\":\"" + janus + "\",\"session_id\":" + session_id + "\",\"transaction\":\"" + transaction + "\",\"sender\":\"" + sender + "\"}";
    }
}
