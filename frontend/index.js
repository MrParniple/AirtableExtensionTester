// Airrtable Extension
import React, { useState, useEffect } from "react";
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
  useCursor,
  useLoadable,
  useWatchable,
  View,
  Img,
  Link,
  useRecords,
  useView,
} from "@airtable/blocks/ui";
import "./styles.css";
import axios from "axios";
// import logo from "../assets/logo.png";

import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";



const firebaseConfig = {
  apiKey: "AIzaSyC-O5CP1WNxAdk-EUJfLDCUOAG_DS738XU",
  authDomain: "tablemateendpoint.firebaseapp.com",
  databaseURL: "https://tablemateendpoint-default-rtdb.firebaseio.com",
  projectId: "tablemateendpoint",
  storageBucket: "tablemateendpoint.appspot.com",
  messagingSenderId: "1040718631728",
  appId: "1:1040718631728:web:6fdc289865fc7e8cd7aef5",
  measurementId: "G-WM5NX0QRTX",
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

const TableMateGPTExtension = () => {
  const base = useBase();
  const cursor = useCursor();
  const globalConfig = useGlobalConfig();
  const gptURL =
    "https://api.openai.com/v1/engines/text-davinci-003/completions";

  const inputFieldId = globalConfig.get("inputField");
  const checkmarkFieldId = globalConfig.get("checkmarkField");
  const outputFieldId = globalConfig.get("outputField");
  const [chatGptApiKey, setChatGptApiKey] = useState("");
  const currentRecordCount = globalConfig.get("currentRecordCount") || 0;

  const inputTable = base.getTableByIdIfExists(cursor.activeTableId);
  const inputView = inputTable
    ? inputTable.getViewByIdIfExists(cursor.activeViewId)
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

  const checkBaseAccess = async () => {
    const baseId = base.id;

    try {
      const checkAccessFunction = httpsCallable(functions, "checkAccess");
      const result = await checkAccessFunction({ baseId });

      if (result.data.success) {
        console.log("Received result from checkAccess:", result.data);
        console.log("Access allowed:", result.data.message);
        console.log("GPT Key:", result.data.chatGPTKey);
        setChatGptApiKey(result.data.chatGPTKey);
        console.log("Set GPT Key:", chatGptApiKey);
        console.log("Current record count:", result.data.currentRecordCount);
        globalConfig.setAsync("currentRecordCount", result.data.currentRecordCount);
        return true;
      } else {
        console.error("Access denied");
        return false;
      }
    } catch (error) {
      console.error("Error calling checkAccess function:", error);
    }
  };



  useEffect(() => {
    checkBaseAccess().then((accessAllowed) => {
      setBaseAuthenticated(accessAllowed);
    });
  }, []);

  
  const setRecordCount = async (recordCount) => {
    const baseId = base.id;
  
    try {
      const updateTaskCountFunction = httpsCallable(functions, "updateTaskCount");
      const result = await updateTaskCountFunction({ baseId, newRecords: recordCount });
  
      console.log('Updated record count:', result.data.updatedRecordCount);
      globalConfig.setAsync("currentRecordCount", result.data.updatedRecordCount);
    } catch (error) {
      console.error('Error updating record count:', error);
    }
  };
  

  // send to chatGPT
  async function sendToGPT() {
    const inputFieldKey = generateConfigKey(cursor.activeTableId, "inputField");
    const outputFieldKey = generateConfigKey(cursor.activeTableId, "outputField");
    const checkmarkFieldKey = generateConfigKey(cursor.activeTableId, "checkmarkField");

    console.log("Active Table:", cursor.activeTableId);
    console.log("Active View:", cursor.activeViewId);

    const input = globalConfig.get(inputFieldKey);
    const output = globalConfig.get(outputFieldKey);
    const checkmark = globalConfig.get(checkmarkFieldKey);

    console.log("Input field:", input);
    console.log("Output field:", output);
    console.log("Checkmark field:", checkmark);

    const inputRecordsResult = await inputView.selectRecordsAsync();
    const outputRecordsResult = await inputView.selectRecordsAsync();
    const inputRecords = inputRecordsResult.records;
    const outputRecords = outputRecordsResult.records;

    const maxTokens = globalConfig.get(generateConfigKey(cursor.activeTableId, "maxTokens")) || 50;
    const temperature = globalConfig.get(generateConfigKey(cursor.activeTableId, "temperature")) || 1;
    const topP = globalConfig.get(generateConfigKey(cursor.activeTableId, "topP")) || 1;
    const bestOf = globalConfig.get(generateConfigKey(cursor.activeTableId, "bestOf")) || 1;

    if (!input || !output || !checkmark) {
      alert("Please select the input, output, and checkmark fields.");
      return;
    }
    console.log("Sending this API Key to GPT:", chatGptApiKey);
    const axiosConfig = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chatGptApiKey}`,
      },
    };
    let invalidApiKeyAlertShown = false;
    let recordQuantity = 0;
    for (const inputRecord of inputRecords) {
      const checkmarkValue = inputRecord.getCellValue(checkmark);
      const outputRecord = outputRecords.find(
        (record) => record.id === inputRecord.id
      );
      const outputResponseValue = outputRecord.getCellValue(output);
      const inputResponseValue = inputRecord.getCellValue(input);

      if (
        (checkmarkValue === true || checkmarkValue === 1) &&
        !outputResponseValue &&
        inputResponseValue
      ) {
        const prompt = inputRecord.getCellValue(input);
        console.log("Input field value:", prompt);
        const requestBody = {
          prompt: prompt,
          max_tokens: parseInt(maxTokens),
          n: bestOf,
          stop: null,
          temperature: parseFloat(temperature),
          top_p: topP,
        };
        try {
          console.log("try statement");
          const response = await axios.post(gptURL, requestBody, axiosConfig);
          const chatGPTResponse = response.data.choices[0].text.trim();
          console.log("response:", chatGPTResponse);
          // Update the output field in the corresponding record in the output table.
          await inputTable.updateRecordAsync(outputRecord, {
            [output]: chatGPTResponse,
          });
          recordQuantity = recordQuantity + 1;
        } catch (error) {
          console.error("Error making API call:", error);
          if (
            error.response &&
            error.response.status === 401
          ) {
            alert("The ChatGPT API Key saved on TableMate seems to be incorrect or no longer active.", error.response);
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
    setRecordCount(recordQuantity);
    // globalConfig.setAsync("recordCount", recordQuantity); // Add this line
  }

  //States
  const [helpVisibility, setHelpVisibility] = useState(false);
  const [advancedVisibility, setAdvancedVisibility] = useState(false);
  const [baseAuthenticated, setBaseAuthenticated] = useState(false); // If this base is authenticated
  const [hasGPTKey, setHasGPTKey] = useState(false); // If there is a corresponding chatGPT key

  const isFieldVisibleInView = (field) => {
    // if (!field || !view) return false;

    // Check if the field is included in the visibleFields array
    return true;
  };

  const generateConfigKey = (tableId, fieldKey) => {
    return `table-${tableId}-${fieldKey}`;
  };

  return (
    <>
      {!baseAuthenticated && ( // Should be "!baseAuthenticated" not "baseAuthenticated"
        <Box padding={3} paddingBottom={0}>
          <Box
            marginBottom={3}
            border="1px solid #d9d9d9;"
            borderRadius={5}
            padding={4}
            paddingTop={5}
            paddingBottom={5}
          >
            {/* Add a message to prompt the user to set up */}
            <Text fontSize={6} marginBottom={2} fontWeight="bold">
              Welcome to TableMate
            </Text>
            <Text fontSize={4} marginBottom={3}>
              Supercharge Airtable with ChatGPT
            </Text>
            <Text fontSize={2}>
              Get started quickly at
              <Link
                href="https://www.tablemate.io/signup-firebase"
                target="_blank"
                rel="noopener noreferrer"
                marginLeft={1}
                marginRight={1}
              >
                TableMate.io
              </Link>
              to connect ChatGPT to all of your desired Airtable bases.
            </Text>
          </Box>
        </Box>
      )}
      <Box padding={3} opacity={baseAuthenticated ? "1" : "0.4"}>
        <Box display="flex" alignItems="center" marginTop={0} marginBottom={2}>
          <Box display="flex" alignItems="center" width="100%">
            {/* <Img src={logo} alt="Logo"/> */}
            {/* <Img src={require('../assets/logo.png')} alt="Logo" /> */}
            <Text
              fontSize="3"
              paddingLeft={1}
              paddingRight={2}
              fontWeight="bold"
              marginTop={0}
              marginBottom={0}
            >
              ChatGPT with TableMate Booty should be working with Output
            </Text>
            {/* For eventual error handling and service status */}
            {baseAuthenticated ? (
              <Box backgroundColor="" padding={1} borderRadius={3}>
                <Text style={{ color: "#11921e" }}></Text>
              </Box>
            ) : (
              <Box backgroundColor="" padding={1} borderRadius={3}>
                <Text style={{ color: "#c4c7cd" }}></Text>
              </Box>
            )}
          </Box>
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
        <Box
          marginBottom={3}
          border="1px solid #d9d9d9;"
          borderRadius={5}
          padding={3}
        >
          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={0} marginBottom={2}>
                Input
              </Text>
              {helpVisibility && (
                <Text
                  marginBottom={2}
                  backgroundColor="#F9F9F9"
                  padding={3}
                  fontStyle="italic"
                >
                  1. Input: Select a field from which you'd like to send a
                  prompt to ChatGPT. This can be a Single Line Text, Multi-Line
                  Text, or Formula field.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                disabled={!baseAuthenticated}
                globalConfigKey={generateConfigKey(cursor.activeTableId, "inputField")}
                allowedTypes={[
                  "singleLineText",
                  "multilineText",
                  "formula",
                  "richText",
                ]}
              />
              {!isFieldVisibleInView(inputField, inputView) && (
                <Text fontStyle="italic" color="warning" marginTop={1}>
                  This field is hidden in this view.
                </Text>
              )}
            </>
          )}

          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Booty should be working with Output
              </Text>
              {helpVisibility && (
                <Text
                  marginBottom={2}
                  backgroundColor="#F9F9F9"
                  padding={3}
                  fontStyle="italic"
                >
                  2. Output: Select a field from which you'd like to receive the
                  response from ChatGPT. This can be a Single Line Text, or
                  Multi-Line Text field.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                disabled={!baseAuthenticated}
                globalConfigKey={generateConfigKey(cursor.activeTableId, "outputField")}
                allowedTypes={["singleLineText", "multilineText", "richText"]}
              />
              {!isFieldVisibleInView(outputField, inputView) && (
                <Text fontStyle="italic" color="warning" marginTop={1}>
                  This field is hidden in this view.
                </Text>
              )}
            </>
          )}
          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Selected Rows
              </Text>
              {helpVisibility && (
                <Text
                  marginBottom={2}
                  backgroundColor="#F9F9F9"
                  padding={3}
                  fontStyle="italic"
                >
                  3. Selected Rows: Select a checkmark or formula field which
                  will output "True", "False", 1, or 0 to indicate which rows to
                  send to ChatGPT.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                disabled={!baseAuthenticated}
                globalConfigKey={generateConfigKey(cursor.activeTableId, "checkmarkField")}
                allowedTypes={["checkbox", "formula"]}
              />
              {!isFieldVisibleInView(checkmarkField, inputView) && (
                <Text fontStyle="italic" color="warning" marginTop={1}>
                  This field is hidden in this view.
                </Text>
              )}
            </>
          )}
          <Button
            marginTop={3}
            icon={advancedVisibility ? "up" : "down"}
            aria-label="Toggle help text"
            size="small"
            variant="secondary"
            className="secondary"
            onClick={() => setAdvancedVisibility(!advancedVisibility)}
          >
            {advancedVisibility && "Hide Advanced Settings"}
            {!advancedVisibility && "Show Advanced Settings"}
          </Button>
          {advancedVisibility && (
            <Box marginTop={3} borderTop="1px solid #d9d9d9;" paddingTop={2} paddingBottom={2} borderBottom="1px solid #d9d9d9;" >
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Advanced ChatGPT Parameters
              </Text>
              <Box display="flex" marginBottom={2}>
                <Box marginRight={2} flexBasis="50%">
                  <Text fontWeight="" marginBottom={1}>
                    Max Tokens
                  </Text>
                  <Input
                    value={globalConfig.get(generateConfigKey(cursor.activeTableId, "maxTokens")) || ""}
                    onChange={(e) => globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "maxTokens"), e.target.value)}
                    placeholder="50"
                    disabled={!baseAuthenticated}
                  />
                </Box>
                <Box flexBasis="50%">
                  <Text fontWeight="" marginBottom={1}>
                    Temperature
                  </Text>
                  <Input
                    value={globalConfig.get(generateConfigKey(cursor.activeTableId, "temperature")) || ""}
                    onChange={(e) => globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "temperature"), e.target.value)}
                    placeholder="1"
                    disabled={!baseAuthenticated}
                  />
                </Box>
              </Box>
              <Box display="flex" marginBottom={1}>
                <Box marginRight={2} flexBasis="50%">
                  <Text fontWeight="" marginBottom={1}>
                    Top P
                  </Text>
                  <Input
                    value={globalConfig.get(generateConfigKey(cursor.activeTableId, "topP")) || ""}
                    onChange={(e) => globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "topP"), e.target.value)}
                    placeholder="50"
                    disabled={!baseAuthenticated}
                  />
                </Box>
                <Box flexBasis="50%">
                  <Text fontWeight="" marginBottom={1}>
                    Best Of
                  </Text>
                  <Input
                    value={globalConfig.get(generateConfigKey(cursor.activeTableId, "bestOf")) || ""}
                    onChange={(e) => globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "bestOf"), e.target.value)}
                    placeholder="1"
                    disabled={!baseAuthenticated}
                  />
                </Box>
              </Box>
            </Box>
          )}
          <Box marginTop={3}>
            {helpVisibility && (
              <Text
                marginBottom={2}
                backgroundColor="#F9F9F9"
                padding={3}
                fontStyle="italic"
              >
                When all of the above fields are filled out, you've written your
                ChatGPT prompts into the Input Field, and you've checked off the
                corresponding rows with the Checkmark Field, press Run.
              </Text>
            )}
            <Box display="flex" alignItems="center">
              <Box width="100%">
                <Button
                  disabled={!baseAuthenticated}
                  variant="primary"
                  onClick={() => sendToGPT()}
                >
                  Run ChatGPT
                </Button>
              </Box>
              <Text width="300px" textAlign="right">
                {currentRecordCount} of 3000 used
              </Text>
            </Box>
          </Box>
          <Box marginTop={3} paddingTop={2} borderTop="1px solid #d9d9d9;">
            <Box display="flex" alignItems="center" marginTop={0} marginBottom={2} flexWrap="wrap">
              <Link
                href="https://www.tablemate.io"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
              >
                TableMate.io
              </Link>
              <Text style={{ color: "#a0a0a0", whiteSpace: "nowrap" }} marginLeft={1} marginRight={1}>|</Text>
              <Link
                href="https://www.tablemate.io/signup-firebase"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
              >
                Tutorials
              </Link>
              <Text style={{ color: "#a0a0a0", whiteSpace: "nowrap" }} marginLeft={1} marginRight={1}>|</Text>
              <Link
                href="https://www.tablemate.io/signup-firebase"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
              >
                Privacy Policy
              </Link>
              <Text style={{ color: "#a0a0a0", whiteSpace: "nowrap" }} marginLeft={1} marginRight={1}>|</Text>
              <Link
                href="https://www.tablemate.io/signup-firebase"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
              >
                Terms & Conditions
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};

initializeBlock(() => <TableMateGPTExtension />);
