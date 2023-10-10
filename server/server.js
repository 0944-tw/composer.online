const WebSocket = require("ws");
const FTP = require("basic-ftp");
const { spawn } = require("child_process");
const wss = new WebSocket.Server({ port: 8080 });
const fs = require("fs");
const { info, dir } = require("console");
const path = require('path');

async function dirSize(dirPath) {
  let size = 0;
  const files = await fs.promises.readdir(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await fs.promises.stat(filePath);
    if (stats.isDirectory()) {
      size += await dirSize(filePath);
    } else {
      size += stats.size;
    }
  }
  return size;
}
// generate random id function
function randomNumber(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  // generate random string
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
function randomID() {
  return `${randomNumber(5)}-${randomNumber(5)}-${randomNumber(
    5
  )}-${randomNumber(5)}`;
}
let ftp_login = async (ftpinfo, password, secure) => {
  let ftp = new FTP.Client();
  let username = ftpinfo.split("@")[0];
  let hostname = ftpinfo.split("@")[1];
  console.log(hostname, username, password);

  try {
    await ftp.access({
      host: hostname,
      user: username,
      password: password,
      secure: secure || false,
    });
    return ftp;
  } catch (err) {
    return false;
  }
};
// Define JSDoc FTP as a type
/**
 * Changes the current working directory of an FTP client.
 * @param {FTP.client} ftp - The FTP client to use.
 * @param {string} dir - The directory to change to.
 * @returns {Promise<FTP.client|boolean>} A Promise that resolves with the FTP client if the directory was changed successfully, or false if an error occurred.
 */
let ftp_gotodir = async (ftp, dir) => {
  try {
    await ftp.cd(dir);
    return ftp;
  } catch (err) {
    console.log(err);
    return false;
  }
};
let validate_json = (json) => {
  try {
    return JSON.parse(json);
  } catch {
    return false;
  }
};

let uploadFolderFiles = async (ftp, folder,to) => {
    
}
let activeSession = [];
let sessionStorage = [];

wss.on("connection", function connection(ws) {
  console.log("Client connected");
  let randomId = randomID();
  ws.send(`Connected: ${randomId}`);

  ws.on("message", async function incoming(message) {
    console.log("received: %s", message);
    try {
      let data = JSON.parse(message);
      ws.send("[1/3] Validating required fields ⚙️");
      if (
        !data.ftpinfo ||
        !data.password ||
        !data.uploadDirectory ||
        !data.composercontent
      ) {
        ws.send("Error: Missing required fields");
        ws.close();
        return;
      }
      ws.send("Success: Received all required fields");
      if (!validate_json(data.composercontent)) {
        ws.send("Error: Composer content is not valid JSON");
        ws.close();
        return;
      }

      // Variables
      let composer_json = JSON.parse(data.composercontent);
      // validate ftp
      ws.send("Validating FTP Credentials");
      let ftp = await ftp_login(data.ftpinfo, data.password);
      if (!ftp) {
        ws.send("Error: FTP Credentials are invalid");
        ws.close();
        return;
      }
      // check directory exists
      ws.send("Validating upload directory");
      let list = await ftp.list();
      let directoryExists = await ftp_gotodir(ftp, data.uploadDirectory);
      if (!directoryExists) {
        ws.send("Error: Upload directory does not exist");
        ws.close();
        return;
      }
      ws.send("Success: Upload directory exists");
      ws.send("[2/3] Download Composer Package 📦");
      // ws.send("Running on PHP 8.2 🐘")
      // Create Directory
      let installFolder = await fs.mkdirSync(`./temp/${randomId}`);
      let composer_json_file = await fs.writeFileSync(
        `./temp/${randomId}/composer.json`,
        data.composercontent
      );
      const composer = spawn("./php/php.exe", [
        "-d",
        "--memory-limit=64M",
        "composer.phar",
        "install",
        `--working-dir=./temp/${randomId}`,
      ]);

      composer.stdout.on("data", (data) => {
        const lines = data.toString().split("\n");
        lines.forEach((line) => {
          console.log(line);
            ws.send(line);
        });
      });

      composer.stderr.on("data", (data) => {
        console.log(data.toString());
        ws.send(data.toString());
      });

      composer.on("close", async (code) => {
    
          
        let size = await dirSize(`./temp/${randomId}`)
        ws.send("[3/3] Uploading to FTP 📡");
        ftp.uploadFromDir(`./temp/${randomId}`)
        ftp.trackProgress((info) => {
            if (info.byte = 0) return;
           ws.send(`Uploaded ${info.bytes} bytes so far - ${info.name} Uploaded ${info.bytesOverall / size * 100}%`)
        })
      });
    } catch (err) {
      ws.send(toString(err));
      ws.send("An error occured, please try again later");
      console.log(err);
      ws.close();
    }
  });
});
