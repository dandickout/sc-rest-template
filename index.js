// Imports
const MongoClient = require("mongodb").MongoClient;

  
//Get environmental variables
let MONGODB_URI = process.env.MONGO_URL;
let MONGODB = process.env.MONGODB;

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;

//support funtion that caches db connection to speed up warm starts
async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  // Connect to our MongoDB database hosted on MongoDB Atlas
  const client = await MongoClient.connect(MONGODB_URI);

  // Specify which database we want to use
  const db = await client.db(MONGODB);

  cachedDb = db;
  return db;
}

//====================================================================================================
//MAIN FUNCTION HANDLER
//====================================================================================================
exports.handler = async (event, context) => {
  /* By default, the callback waits until the runtime event loop is empty before freezing the process and returning the results to the caller. 
  Setting this property to false requests that AWS Lambda freeze the process soon after the callback is invoked, even if there are events in the event loop. 
  AWS Lambda will freeze the process, any state data, and the events in the event loop. 
  Any remaining events in the event loop are processed when the Lambda function is next invoked, if AWS Lambda chooses to use the frozen process. */
  context.callbackWaitsForEmptyEventLoop = false;

  //log the incoming event for troubleshooting
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  //set up a default response package
  let body;
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json',
    };
  
  
  // Get an instance of our database
  try {
    var db = await connectToDatabase();    
  } 
  catch (error) {
    const errorString = "Error connection to database " + error.stack;
    console.error(errorString);
    response = {
            statusCode: 500,
            body: JSON.stringify(errorString)
        };
    return response;
  }

  // ++ Parse incoming variables ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  try {
    switch (event.httpMethod) {

      case 'DELETE':
          break;

      case 'GET':
          break;

      case 'POST':
          break;

      case 'PUT':
          break;

      default:
          throw new Error(`Unsupported method "${event.httpMethod}"`);

    } 
  } catch (err) {
      statusCode = '400';
      body = err.message;
  } finally {
      body = JSON.stringify(body);
  }

  // ++ Process Prep ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++



  // ++ Process method ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  try {
    switch (event.httpMethod) {
        case 'DELETE':
            body = await db.collection(somecollection).deleteOne(singledocument).promise();
            break;
        case 'GET':
            body = await db.collection(somecollection).find(query).promise();
            break;
        case 'POST':
            body = await db.collection(somecollection).insertOne(document).promise();
            break;
        case 'PUT':
            body = await db.collection(somecollection).updateOne(document).promise();
            break;
        default:
            throw new Error(`Unsupported method "${event.httpMethod}"`);
    }
  } catch (err) {
      statusCode = '400';
      body = err.message;
  } finally {
      body = JSON.stringify(body);
  }
 
  return {
    statusCode,
    body,
    headers,
  };
    
};
