import axios from "axios";
import config from "./config.json";
import { chatgptApiKey } from "../src/config";
import { ExtensionStateProvider, useExtensionState } from "./states";

const { 
    apiKey, setApiKey,
    showApiKey, setShowApiKey,
    isApiEntered, setIsApiEntered,
    isHelpVisible, setIsHelpVisible,
    disableFields, setDisableFields,
    chatGptApiKey, setChatGptApiKey,
    inputText, setInputText,
    response, setResponse 
  } = useExtensionState();


const chatGPTURL = config.chatGPTURL;
const testEndpointUrl = config.testEndpointUrl;


console.log(chatGPTURL);
console.log(testEndpointUrl);

export async function handleApiKeyChange(event, setApiKey, setIsApiEntered) {
  const newApiKey = event.target.value;
  setApiKey(newApiKey);
  localStorage.setItem("tableMateApiKey", newApiKey);
  setIsApiEntered(true);
}

export async function handleApiKeySubmit(apiKey, setDisableFields,setChatGptApiKey,chatGptApiKey,setIsApiEntered) {
  if (!apiKey) {
    setDisableFields(true);
    alert(
      "Please enter your TableMate Member ID, which you can find at https://www.tablemate.io/user/apis."
    );
    return;
  }

  console.log("the member ID being sent is ", apiKey);

  try {
    const response = await fetch(testEndpointUrl);
    const data = await response.json();
    console.log("Data from Netlify function:", data);

    if (data && data.chatgptApiKey) {
      sessionStorage.setItem("chatgptKey", data.chatgptApiKey);
      toggleApiKeyVisibility();
      setChatGptApiKey(chatGptApiKey);
      setIsApiEntered(true);
      setDisableFields(false);
      console.log("Data back from Netlify", data);
    } else {
      setDisableFields(true);
      alert("Unable to retrieve member data. Please try again.");
    }
  } catch (error) {
    console.error("Error from Netlify function:", error);
    alert(
      "An error occurred while testing the connection. Please check your TableMate Member ID and try again."
    );
  }
}

export async function handleSendRequest(chatGptApiKey, inputTable, inputField, outputField, checkmarkField, countRecords) {
  console.log("handleClick started");
  if (!chatGptApiKey) {
    alert(
      "Please enter your TableMate Member ID and ensure that you have a valid ChatGPT API key."
    );
    return;
  }

  if (!inputTable || !inputField || !outputField || !checkmarkField) {
    alert("Please make sure all fields are selected.");
    return;
  }

  const inputRecordsResult = inputTable.selectRecords();
  const outputRecordsResult = inputTable.selectRecords();

  await inputRecordsResult.loadDataAsync();
  await outputRecordsResult.loadDataAsync();

  const inputRecords = inputRecordsResult.records;
  const outputRecords = outputRecordsResult.records;

  const axiosConfig = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${chatGptApiKey}`, // Update this line
    },
  };

  let invalidApiKeyAlertShown = false; // Add this line to create a flag

  // console.log("API Key:", apiKey); // Add this line
  const recordQuantity = 0;
  for (const inputRecord of inputRecords) {
    const checkmarkValue = inputRecord.getCellValue(checkmarkField);
    const outputRecord = outputRecords.find(
      (record) => record.id === inputRecord.id
    );
    // const inputRecord = inputRecords.find((record) => record.id === inputRecord.id);
    const outputResponseValue = outputRecord.getCellValue(outputField);
    const inputResponseValue = inputRecord.getCellValue(inputField);

    // console.log(inputResponseValue)

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

      //console.log("Request Body:", requestBody);

      try {
        const response = await axios.post(chatGPTURL, requestBody, axiosConfig);
        const chatGPTResponse = response.data.choices[0].text.trim();

        // Update the output field in the corresponding record in the output table.
        await inputTable.updateRecordAsync(outputRecord, {
          [outputField.id]: chatGPTResponse,
        });
        recordQuantity = recordQuantity + 1;
      } catch (error) {
        console.error("Error making API call:", error);

        // Modify the condition to check the flag
        if (
          !invalidApiKeyAlertShown &&
          error.response &&
          error.response.status === 401
        ) {
          invalidApiKeyAlertShown = true; // Set the flag to true after showing the alert
          alert("Invalid API key. Please check your API key and try again.");
          break; // Add this line to stop the loop
        } else {
          alert(
            "An error occurred while making the API call. Please check the console for more details."
          );
        }
      }
    }
  }
  console.log("handleClick finished");
  countRecords(recordQuantity);
}
