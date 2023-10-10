const { config } = require("process")

// Configruation:
let configuration = {
    recaptcha: {
        enabled: false,
        site_key: ""
    }
}



// Tab Module: Change tab when click #next Code:
let wslogger = (msg) => {
    let original = $("#realtime-log").text()
    $("#realtime-log").text(`${original}\n${msg.toString()}`)
}
let parsewserr = (event) => {
    if (event.code == 1000)
    reason = "Normal closure, meaning that the purpose for which the connection was established has been fulfilled.";
else if(event.code == 1001)
    reason = "An endpoint is \"going away\", such as a server going down or a browser having navigated away from a page.";
else if(event.code == 1002)
    reason = "An endpoint is terminating the connection due to a protocol error";
else if(event.code == 1003)
    reason = "An endpoint is terminating the connection because it has received a type of data it cannot accept (e.g., an endpoint that understands only text data MAY send this if it receives a binary message).";
else if(event.code == 1004)
    reason = "Reserved. The specific meaning might be defined in the future.";
else if(event.code == 1005)
    reason = "No status code was actually present.";
else if(event.code == 1006)
   reason = "The connection was closed abnormally, e.g., without sending or receiving a Close control frame";
else if(event.code == 1007)
    reason = "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message (e.g., non-UTF-8 [https://www.rfc-editor.org/rfc/rfc3629] data within a text message).";
else if(event.code == 1008)
    reason = "An endpoint is terminating the connection because it has received a message that \"violates its policy\". This reason is given either if there is no other sutible reason, or if there is a need to hide specific details about the policy.";
else if(event.code == 1009)
   reason = "An endpoint is terminating the connection because it has received a message that is too big for it to process.";
else if(event.code == 1010) // Note that this status code is not used by the server, because it can fail the WebSocket handshake instead.
    reason = "An endpoint (client) is terminating the connection because it has expected the server to negotiate one or more extension, but the server didn't return them in the response message of the WebSocket handshake. <br /> Specifically, the extensions that are needed are: " + event.reason;
else if(event.code == 1011)
    reason = "A server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.";
else if(event.code == 1015)
    reason = "The connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).";
else
    reason = "Unknown reason";
return reason;
}

$(document).ready(function() {
    if (configuration.recaptcha.enabled) {
        grecaptcha.render('recaptcha', {
            'sitekey' : configuration.recaptcha.site_key,
            'theme' : 'dark'
          });
    }
    $("#next").on("click",() => {
        console.log("Next Step")
         $("#step2-tab").click();
        });
        $("#finish").on("click",() => {
            $("#step3-tab").click();
            console.log("Creating WebSocket Connection")
            try {
                var socket = new WebSocket('ws://localhost:8080');
                socket.addEventListener('close', function (event) {
                    console.log(event)
                    wslogger('Error: ' + parsewserr(event));
                  });
                  socket.addEventListener('open', function (event) {
                    wslogger("😊Connected to WebSocket Server😊")
                    wslogger("😵‍💫Sending Data😵‍💫")
                    socket.send(JSON.stringify({
                        ftpinfo: $("#ftp_info").val(),
                        password: $("#ftp_pass").val(),
                        uploadDirectory: $("#upload_path").val(),
                        composercontent: $("#composer-content").val()
                    }))
                  });
                  socket.addEventListener('message', function (event) {
                    wslogger( event.data);
                    document.getElementById("textarea").scrollTop = document.getElementById("textarea").scrollHeight 
                  })
            } catch (err) {
            // add content to realtime-log
            console.log(err)
               wslogger(err)
            }
            
        })
})
// Finish Part
