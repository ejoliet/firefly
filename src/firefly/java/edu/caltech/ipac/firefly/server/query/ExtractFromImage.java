package edu.caltech.ipac.firefly.server.query;

import edu.caltech.ipac.firefly.data.ServerParams;
import edu.caltech.ipac.firefly.data.TableServerRequest;
import edu.caltech.ipac.firefly.server.SrvParam;
import edu.caltech.ipac.table.DataGroup;
import edu.caltech.ipac.table.io.FITSTableReader;
import edu.caltech.ipac.visualize.plot.ImagePt;
import edu.caltech.ipac.visualize.plot.WorldPt;
import nom.tam.fits.FitsException;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Extract data from an image and make a table
 */
@SearchProcessorImpl(id = ExtractFromImage.ID, params=
        {
                @ParamDoc(name="extractionType", desc="should be one of z-axis, line, or points"),
                @ParamDoc(name="pt", desc="image point"),
                @ParamDoc(name="pt2", desc="second image point, if line"),
                @ParamDoc(name="ptAry", desc="for point selection"),
                @ParamDoc(name="wptAry", desc="for point selection, added to the created table"),
                @ParamDoc(name="wlAry", desc="an array of wavelength to add to the table, added to the created table"),
                @ParamDoc(name="wlUnit", desc="wavelength units. if defined"),
                @ParamDoc(name="fluxUnit", desc="flux units. if defined"),
                @ParamDoc(name="filename", desc="filename on the server"),
                @ParamDoc(name="refHDUNum", desc="hdu number to extract"),
                @ParamDoc(name="extractionSize", desc="number of the square size of the extract, i.e. 4 would be 4x4"),
                @ParamDoc(name="allMatchingHDUs", desc="extract every HDU that matches the refHDU")
        })
public class ExtractFromImage extends EmbeddedDbProcessor {

    public static final String ID = "ExtractFromImage";
    public static final String EXTRACTION_TYPE = "extractionType";
    public static final String FILENAME = "filename";
    public static final String REF_HDU_NUM = "refHDUNum";
    public static final String EXTRACTION_SIZE = "extractionSize";
    public static final String ALL_MATCHING_HDUS = "allMatchingHDUs";

    @Override
    public DataGroup fetchDataGroup(TableServerRequest req) throws DataAccessException {
        String extType = req.getParam(EXTRACTION_TYPE);
        String filename = req.getParam(FILENAME);
        int extractionSize = req.getIntParam(EXTRACTION_SIZE, 1);
        int refHduNum = req.getIntParam(REF_HDU_NUM, -1);
        int plane = req.getIntParam(ServerParams.PLANE, -1);
        boolean allMatchingHDUs = req.getBooleanParam(ALL_MATCHING_HDUS, true);
        try {
            if (extType == null || extType.equals("z-axis")) {
                ImagePt pt = ImagePt.parse(req.getParam(ServerParams.PT));
                checkZAxisParams(pt, filename, refHduNum);
                String wlUnit= req.getParam(ServerParams.WL_UNIT);
                Map<Integer,String> fluxUnit= makeMapOfUnitsFromParam(req);
                double[] wlAry= SrvParam.getDoubleAryFromJson(req.getParam(ServerParams.WL_ARY));
                return FITSTableReader.getCubeZaxisAsTable(pt, filename, refHduNum, allMatchingHDUs, extractionSize, wlAry,wlUnit,fluxUnit);
            }
            else if (extType.equals("line")) {
                ImagePt pt = ImagePt.parse(req.getParam(ServerParams.PT));
                ImagePt pt2 = ImagePt.parse(req.getParam(ServerParams.PT2));
                checkLineParams(pt, pt2, plane, filename, refHduNum);
                return FITSTableReader.getLineSelectAsTable(pt, pt2, filename, refHduNum, plane, allMatchingHDUs, extractionSize);
            } else if (extType.equals("points")) {
                ImagePt[] ptAry= SrvParam.getImagePtAryFromJson(req.getParam(ServerParams.PTARY));
                WorldPt[] wptAry= SrvParam.getWorldPtAryFromJson(req.getParam(ServerParams.WPT_ARY));
                checkPointParams(ptAry, plane, filename, refHduNum);
                return FITSTableReader.getPointsAsTable(ptAry, wptAry, filename, refHduNum, plane, allMatchingHDUs, extractionSize);
            }
        } catch (IOException | FitsException e) {
            throw new IllegalArgumentException("Could not make a table from extracted data");
        }
        throw new IllegalArgumentException("extractionType must be z-axis, line, or points");
    }


    private static Map<Integer,String> makeMapOfUnitsFromParam(TableServerRequest req) {
        String[] sAry= SrvParam.getStringAryFromJson(req.getParam(ServerParams.FLUX_UNIT));
        Map<Integer,String> fluxUnit= new HashMap<>();
        if (sAry!=null) {
            for(String entry : sAry) {
                String[] s= entry.split("=");
                if (s.length==2) {
                    try {
                        int hdu= Integer.parseInt(s[0]);
                        fluxUnit.put(hdu,s[1]);
                    } catch (NumberFormatException ignore) { }
                }
            }
        }
        return fluxUnit;
    }

    private static void checkZAxisParams(ImagePt pt, String filename, int refHduNum) {
        if (pt==null) throw new IllegalArgumentException("Point is require for z-axis extraction");
        if (filename==null) throw new IllegalArgumentException("filename is require for z-axis extraction");
        if (refHduNum<0) throw new IllegalArgumentException("refHduNum is require for z-axis extraction");
    }

    private static void checkLineParams(ImagePt pt, ImagePt pt2, int plane, String filename, int refHduNum) {
        if (pt==null) throw new IllegalArgumentException("Point is require for line extraction");
        if (pt2==null) throw new IllegalArgumentException("Point2 is require for line extraction");
        if (filename==null) throw new IllegalArgumentException("filename is require for line extraction");
        if (refHduNum<0) throw new IllegalArgumentException("refHduNum is require for line extraction");
        if (plane<0) throw new IllegalArgumentException("refHduNum is require for line extraction");
    }

    private static void checkPointParams(ImagePt[] ptAry, int plane, String filename, int refHduNum) {
        if (ptAry==null || ptAry.length==0) throw new IllegalArgumentException("ptAry is require for points extraction");
        if (filename==null) throw new IllegalArgumentException("filename is require for points extraction");
        if (refHduNum<0) throw new IllegalArgumentException("refHduNum is require for points extraction");
        if (plane<0) throw new IllegalArgumentException("refHduNum is require for points extraction");
    }

}
