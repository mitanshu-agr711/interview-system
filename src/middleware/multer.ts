import multer from "multer";

const storage = multer.diskStorage(
    {
        destination: function (req, file, cb) {
            cb(null, './public/temp')//public yha isliye rakha kyu ki ye puch rha tha kha store karna hai hum ne bataya public mai karo
        },
        filename: function (req, file, cb) {
            // const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            // cb(null, file.fieldname + '-' + uniqueSuffix)
            // from uniquesuffix se name generate3 kar rhe hai but abhi hum use user ne jo name bhar usi pe kam kar te hai
            cb(null, file.originalname)
            // console.log(file.originalname);
           
        }
    }
)
export const upload = multer({ storage,});
//ye storage fun. hame file name dega