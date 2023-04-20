import React, { useState } from "react";
import {
  useBase,
  Input,
  Box,
  Text,
  Button,
  initializeBlock,
  useGlobalConfig,
  TablePickerSynced,
  ViewPickerSynced,
  FieldPickerSynced,
} from "@airtable/blocks/ui";
import "./styles.css";
// import {} from "./functions";
// import { ExtensionStateProvider, useExtensionState } from "./states";
import axios from "axios";
// Import firebase
import firebase from "@firebase/app";
import "@firebase/functions";

// Initialize firebase
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const functions = firebase.functions();


const TableMateGPTExtension = () => {
  const base = useBase();
  const globalConfig = useGlobalConfig();
  const chatGptApiKey = "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";
  const gptURL = "https://api.openai.com/v1/engines/text-davinci-003/completions";

  const inputTableId = globalConfig.get("inputTable");
  const inputTable = base.getTableByIdIfExists(inputTableId);
  const inputViewId = globalConfig.get("viewField");
  const inputFieldId = globalConfig.get("inputField");
  const checkmarkFieldId = globalConfig.get("checkmarkField");
  const outputFieldId = globalConfig.get("outputField");
  
  const inputView = inputTable
    ? inputTable.getViewByIdIfExists(inputViewId)
    : null;
  const inputField = inputTable
    ? inputTable.getFieldByIdIfExists(inputFieldId)
    : null;
  const checkmarkField = inputTable
    ? inputTable.getFieldByIdIfExists(checkmarkFieldId)
    : null;
  const outputField = inputTable
    ? inputTable.getFieldByIdIfExists(outputFieldId)
    : null;

  // send to chatGPT
  const sendToGPT = async () => {
    if (!inputTable || !inputField || !outputField || !checkmarkField) {
      alert("Please make sure all fields are selected.");
      return;
    }
    const inputRecordsResult = await inputView.selectRecordsAsync();
    const outputRecordsResult = await inputView.selectRecordsAsync();
    const inputRecords = inputRecordsResult.records;
    const outputRecords = outputRecordsResult.records;
    const axiosConfig = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chatGptApiKey}`,
      },
    };
    let invalidApiKeyAlertShown = false;
    // let recordQuantity = 0;
    for (const inputRecord of inputRecords) {
      const checkmarkValue = inputRecord.getCellValue(checkmarkField);
      const outputRecord = outputRecords.find(
        (record) => record.id === inputRecord.id
      );
      const outputResponseValue = outputRecord.getCellValue(outputField);
      const inputResponseValue = inputRecord.getCellValue(inputField);
      if (checkmarkValue === true && !outputResponseValue && inputResponseValue) {
        const prompt = inputRecord.getCellValue(inputField);
        const requestBody = {
          prompt: prompt,
          max_tokens: 50,
          n: 1,
          stop: null,
          temperature: 1,
          top_p: 1,
        };
        try {
          const response = await axios.post(gptURL, requestBody, axiosConfig);
          const chatGPTResponse = response.data.choices[0].text.trim();
          // Update the output field in the corresponding record in the output table.
          await inputTable.updateRecordAsync(outputRecord, {
            [outputField.id]: chatGPTResponse,
          });
          // recordQuantity = recordQuantity + 1;
        } catch (error) {
          console.error("Error making API call:", error);
          if (
            !invalidApiKeyAlertShown &&
            error.response &&
            error.response.status === 401
          ) {
            invalidApiKeyAlertShown = true;
            alert("Invalid API key. Please check your API key and try again.");
            break;
          } else {
            alert(
              "An error occurred while making the API call. Please check the console for more details."
            );
          }
        }
      }
    }
    console.log("handleClick finished");
    // setRecordCount(recordQuantity);
  };




  // const gptURL = config.gptURL;
  // const tableMateURL = config.tableMateURL;


  //States
  const [helpVisibility, setHelpVisibility] = useState(false);
  const [tableMateKeyVerified, setTableMateKeyVerified] = useState(true);
  const [gptkeyVerified, setGptkeyVerified] = useState(true);
  const [apiInputVisibility, setApiInputVisibility] = useState(true);
  // const [planValid, setPlanValid] = useState(true);
  const [formEnabled, setFormEnabled] = useState(tableMateKeyVerified && gptkeyVerified);



  return (
    <>
      <Box padding={3}>
        <Box marginBottom={3}>
          <Button
            icon={helpVisibility ? "up" : "down"}
            aria-label="Toggle help text"
            size="small"
            variant="secondary"
            className="secondary"
            onClick={() => setHelpVisibility(!helpVisibility)}
          >
            {helpVisibility && "Hide Instructions"}
            {!helpVisibility && "Show Instructions"}
          </Button>
        </Box>

{/*         
        <Box
          marginBottom={3}
          border="1px solid #d9d9d9;"
          borderRadius={5}
          padding={3}
        >
          <Text fontWeight="bold" marginBottom={1}>
            Connect TableMate
          </Text>
          <Box display="flex" alignItems="center">
            {formEnabled && (
              <>
                <Input
                  value={apiKey}
                  onChange={}
                  placeholder="Enter your API key"
                />
                <Button
                  onClick={}
                  variant="primary"
                  marginLeft={2}
                >
                  Submit
                </Button>
              </>
            )}

            {formEnabled && (
              <Text
                style={{ color: "green" }}
                marginTop={2}
                marginBottom={1}
                marginRight={2}
              >
                You're connected to TableMate
              </Text>
            )}

            {formEnabled && (
              <Button
                variant="secondary"
                onClick={() => setApiInputVisibility(!apiInputVisibility)}
                className="secondary"
              >
                {apiInputVisibility ? "View API Key" : "Hide API Key"}
              </Button>

            )}
          </Box>
          {formEnabled && (
            <Box marginTop={2} marginBottom={1}>
              <a
                style={{ color: "rgb(45,127,249)" }}
                href="https://www.tablemate.io/user/apis"
                target="_blank"
                rel="noreferrer noopener"
              >
                Find your TableMate API here.
              </a>
            </Box>
          )}
        </Box>
         */}
        <Box
          marginBottom={3}
          border="1px solid #d9d9d9;"
          borderRadius={5}
          padding={3}
          opacity={formEnabled ? "1" : ".4"}
        >
          <Text fontWeight="bold" marginTop={2} marginBottom={1}>
            Input Table
          </Text>
          {helpVisibility && (
            <Text marginBottom={2}>
              1. Select a table from which you'd like to send a prompt to
              ChatGPT.
            </Text>
          )}
          <TablePickerSynced
            disabled={!formEnabled}
            globalConfigKey="inputTable"
          />

          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Input View
              </Text>
              {helpVisibility && (
                <Text marginBottom={2}>
                  2. Select a view from that tablle from which you'd like to
                  send a prompt to ChatGPT.
                </Text>
              )}
              <ViewPickerSynced
                table={inputTable}
                disabled={!formEnabled}
                globalConfigKey="viewField"
              />
            </>
          )}

          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Input Field
              </Text>
              {helpVisibility && (
                <Text marginBottom={2}>
                  3. Select a field from that table and view from which you'd
                  like to send a prompt to ChatGPT. This can be a Single Line
                  Text, Multi-Line Text, or Formula field.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                globalConfigKey="inputField"
                disabled={!formEnabled}
                allowedTypes={[
                  "singleLineText",
                  "multilineText",
                  "formula",
                  "richText",
                ]}
                onChange={(newFieldId) => setInputFieldId(newFieldId)}
              />
            </>
          )}

          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Ready to Send
              </Text>
              {helpVisibility && (
                <Text marginBottom={2}>
                  4. Select a checkmark or formula field which will output
                  "True", "False", 1, or 0 to indicate which rows you would like
                  to send to ChatGPT.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                globalConfigKey="checkmarkField"
                disabled={!formEnabled}
                allowedTypes={["checkbox", "formula"]}
              />
            </>
          )}

          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Output Field
              </Text>
              {helpVisibility && (
                <Text marginBottom={2}>
                  5. Select a table, view, and field from which you'd like to
                  send a prompt to ChatGPT.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                globalConfigKey="outputField"
                disabled={!formEnabled}
                allowedTypes={["singleLineText", "multilineText", "richText"]}
              />
            </>
          )}
          <Box marginTop={3}>
            {helpVisibility && (
              <Text marginBottom={2}>
                6. When all of the above fields are filled out, you've written
                your ChatGPT prompts into the Input Field, and you've checked
                off the corresponding rows with the Checkmark Field, press Run.
              </Text>
            )}
            <Button
              variant="primary"
              onClick={sendToGPT}
              disabled={!formEnabled}
            >
              Run ChatGPT
            </Button>
          </Box>
        </Box>
      </Box>
    </>
  );
};

// const WrappedTableMateGPTExtension = () => (
//   <ExtensionStateProvider>
//     <TableMateGPTExtension />
//   </ExtensionStateProvider>
// );

//initializeBlock(() => <WrappedTableMateGPTExtension />);

initializeBlock(() => <TableMateGPTExtension />);
